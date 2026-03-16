package hu.jager.promo_backend.service;

import hu.jager.promo_backend.entity.*;
import hu.jager.promo_backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class DrawService {

    private final InventoryItemRepository inventoryRepo;
    private final AppSettingsRepository settingsRepo;
    private final WinningMomentRepository winningMomentRepo;

    /**
     * Fő sorsolási metódus — GameService hívja nyeréskor.
     * Visszaadja a kisorsolt itemet, vagy null-t ha minden elfogyott (esemény leáll).
     */
    @Transactional
    public InventoryItem draw(AppUser winner) {
        AppSettings settings = settingsRepo.findById(1L).orElseThrow();

        InventoryItem result;
        if ("TIMED".equals(settings.getDrawMode())) {
            result = drawTimed(winner);
        } else {
            result = drawWeighted(winner);
        }

        // Ha null → minden elfogyott → automatikusan leállítjuk az eseményt
        if (result == null) {
            log.warn("Minden nyeremény elfogyott! Esemény automatikusan leáll.");
            settings.setEventActive(false);
            settingsRepo.save(settings);
        }

        return result;
    }

    // ======================== TIMED MÓD ========================

    /**
     * Nyerő pillanatok módszer:
     * - Ha van lejárt, még ki nem adott nyerő pillanat → annak itemjét adja (merch vagy shot)
     * - Ha nincs lejárt pillanat → shot fallback
     * - Ha shot sincs → null (leállás)
     */
    private InventoryItem drawTimed(AppUser winner) {
        LocalDateTime now = LocalDateTime.now();
        Optional<WinningMoment> moment = winningMomentRepo.findNextUnclaimedMoment(now);

        if (moment.isPresent()) {
            WinningMoment wm = moment.get();
            InventoryItem item = wm.getInventoryItem();

            item.setRemainingQuantity(item.getRemainingQuantity() - 1);
            inventoryRepo.save(item);

            wm.setClaimed(true);
            wm.setClaimedBy(winner);
            wm.setClaimedAt(now);
            winningMomentRepo.save(wm);

            log.info("TIMED: nyerő pillanat → {} kapta: {}", winner.getEmail(), item.getName());
            return item;
        }

        // Nincs lejárt pillanat → shot
        log.info("TIMED: nincs aktív pillanat → shot fallback");
        return fallbackToShot(winner);
    }

    // ======================== WEIGHTED MÓD ========================

    /**
     * Súlyozott sorsolás:
     * Minden elérhető item a remainingQuantity arányában verseng.
     * Shot természetesen több van → nagyobb esély.
     * Ha merch elfogy → csak shot marad.
     */
    private InventoryItem drawWeighted(AppUser winner) {
        List<InventoryItem> available = inventoryRepo.findByRemainingQuantityGreaterThan(0);

        if (available.isEmpty()) return null;

        int totalWeight = available.stream()
                .mapToInt(InventoryItem::getRemainingQuantity)
                .sum();

        int rand = new Random().nextInt(totalWeight);
        int cumulative = 0;
        InventoryItem selected = available.get(0);

        for (InventoryItem item : available) {
            cumulative += item.getRemainingQuantity();
            if (rand < cumulative) {
                selected = item;
                break;
            }
        }

        selected.setRemainingQuantity(selected.getRemainingQuantity() - 1);
        inventoryRepo.save(selected);

        log.info("WEIGHTED: {} kapta: {}", winner.getEmail(), selected.getName());
        return selected;
    }

    // ======================== SHOT FALLBACK ========================

    /**
     * Ha nincs aktív nyerő pillanat (timed módban):
     * A legtöbb készletű liquid itemet adja.
     */
    private InventoryItem fallbackToShot(AppUser winner) {
        return inventoryRepo.findByRemainingQuantityGreaterThan(0)
                .stream()
                .filter(InventoryItem::isLiquid)
                .max(Comparator.comparingInt(InventoryItem::getRemainingQuantity))
                .map(shot -> {
                    shot.setRemainingQuantity(shot.getRemainingQuantity() - 1);
                    inventoryRepo.save(shot);
                    log.info("SHOT fallback: {} → {}", winner.getEmail(), shot.getName());
                    return shot;
                })
                .orElse(null); // Shot is elfogyott → teljes leállás
    }

    // ======================== NYERŐ PILLANATOK GENERÁLÁSA ========================

    /**
     * Admin hívja (settings mentésekor, ha TIMED mód és van start/end).
     * Minden non-liquid (merch) item készletének megfelelő számú pillanatot generál,
     * egyenletesen elosztva az esemény időtartamán.
     * A shot itemekhez NEM generál pillanatot — azok mindig fallback-ként szerepelnek.
     */
    @Transactional
    public int generateWinningMoments(LocalDateTime eventStart, LocalDateTime eventEnd) {
        // Töröljük a régi, még ki nem adott pillanatokat
        winningMomentRepo.deleteAllByClaimedFalse();

        List<InventoryItem> merchItems = inventoryRepo.findByRemainingQuantityGreaterThan(0)
                .stream()
                .filter(item -> !item.isLiquid()) // csak merch, shot nem kap pillanatot
                .toList();

        if (merchItems.isEmpty()) {
            log.info("Nincs merch item → nem generálunk nyerő pillanatokat");
            return 0;
        }

        long totalSeconds = ChronoUnit.SECONDS.between(eventStart, eventEnd);
        List<WinningMoment> moments = new ArrayList<>();
        Random random = new Random();

        for (InventoryItem item : merchItems) {
            int quantity = item.getRemainingQuantity();
            // Az időtartamot felosztjuk quantity darab egyenlő szeletre
            long sliceSeconds = totalSeconds / quantity;

            for (int i = 0; i < quantity; i++) {
                // Minden szeletben véletlenszerű időpont
                long offsetStart = i * sliceSeconds;
                long offsetEnd = (i + 1) * sliceSeconds;
                long randomOffset = offsetStart + (long)(random.nextDouble() * (offsetEnd - offsetStart));

                LocalDateTime scheduledAt = eventStart.plusSeconds(randomOffset);

                WinningMoment wm = new WinningMoment();
                wm.setInventoryItem(item);
                wm.setScheduledAt(scheduledAt);
                wm.setClaimed(false);
                moments.add(wm);
            }

            log.info("Generálva: {} db pillanat → {}", quantity, item.getName());
        }

        winningMomentRepo.saveAll(moments);
        log.info("Összesen {} nyerő pillanat generálva ({} - {})", moments.size(), eventStart, eventEnd);
        return moments.size();
    }

    /**
     * Manuális módban: activatedAt-tól számol, nincs előre generálás.
     * Ha nincs start/end, de TIMED módban van → weighted-re esik vissza.
     */
    public boolean hasTimetableForCurrentEvent() {
        AppSettings s = settingsRepo.findById(1L).orElseThrow();
        return "TIMED".equals(s.getDrawMode())
                && s.getEventStart() != null
                && s.getEventEnd() != null
                && winningMomentRepo.countByClaimedFalse() > 0;
    }
}
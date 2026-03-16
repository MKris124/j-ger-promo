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
     * Visszaadja a kisorsolt InventoryItem-et (NEM vonja le a készletből —
     * a készlet levonás a PromoterService.redeemPrize()-ban történik beváltáskor).
     * Ha semmi sincs → null → esemény leáll.
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

        if (result == null) {
            log.warn("Minden nyeremény elfogyott! Esemény automatikusan leáll.");
            settings.setEventActive(false);
            settingsRepo.save(settings);
        }

        return result;
    }

    // ======================== TIMED MÓD ========================

    private InventoryItem drawTimed(AppUser winner) {
        LocalDateTime now = LocalDateTime.now();
        Optional<WinningMoment> moment = winningMomentRepo.findNextUnclaimedMoment(now);

        if (moment.isPresent()) {
            WinningMoment wm = moment.get();
            InventoryItem item = wm.getInventoryItem();

            // NEM vonjuk le a készletet itt — csak a pillanatot jelöljük kiadottnak
            wm.setClaimed(true);
            wm.setClaimedBy(winner);
            wm.setClaimedAt(now);
            winningMomentRepo.save(wm);

            log.info("TIMED: nyerő pillanat → {} kapta: {}", winner.getEmail(), item.getName());
            return item;
        }

        log.info("TIMED: nincs aktív pillanat → shot fallback");
        return fallbackToShot(winner);
    }

    // ======================== WEIGHTED MÓD ========================

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
            if (rand < cumulative) { selected = item; break; }
        }

        // NEM vonjuk le — csak kisorsolás, levonás beváltáskor
        log.info("WEIGHTED: {} kapta: {}", winner.getEmail(), selected.getName());
        return selected;
    }

    // ======================== SHOT FALLBACK ========================

    private InventoryItem fallbackToShot(AppUser winner) {
        return inventoryRepo.findByRemainingQuantityGreaterThan(0)
                .stream()
                .filter(InventoryItem::isLiquid)
                .max(Comparator.comparingInt(InventoryItem::getRemainingQuantity))
                .map(shot -> {
                    // NEM vonjuk le — levonás beváltáskor
                    log.info("SHOT fallback: {} → {}", winner.getEmail(), shot.getName());
                    return shot;
                })
                .orElse(null);
    }

    // ======================== NYERŐ PILLANATOK GENERÁLÁSA ========================

    @Transactional
    public int generateWinningMoments(LocalDateTime eventStart, LocalDateTime eventEnd) {
        winningMomentRepo.deleteAllByClaimedFalse();

        List<InventoryItem> merchItems = inventoryRepo.findByRemainingQuantityGreaterThan(0)
                .stream()
                .filter(item -> !item.isLiquid())
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
            long sliceSeconds = totalSeconds / quantity;

            for (int i = 0; i < quantity; i++) {
                long offsetStart = i * sliceSeconds;
                long offsetEnd = (i + 1) * sliceSeconds;
                long randomOffset = offsetStart + (long)(random.nextDouble() * (offsetEnd - offsetStart));

                WinningMoment wm = new WinningMoment();
                wm.setInventoryItem(item);
                wm.setScheduledAt(eventStart.plusSeconds(randomOffset));
                wm.setClaimed(false);
                moments.add(wm);
            }
            log.info("Generálva: {} db pillanat → {}", quantity, item.getName());
        }

        winningMomentRepo.saveAll(moments);
        log.info("Összesen {} nyerő pillanat generálva", moments.size());
        return moments.size();
    }

    public boolean hasTimetableForCurrentEvent() {
        AppSettings s = settingsRepo.findById(1L).orElseThrow();
        return "TIMED".equals(s.getDrawMode())
                && s.getEventStart() != null
                && s.getEventEnd() != null
                && winningMomentRepo.countByClaimedFalse() > 0;
    }
}
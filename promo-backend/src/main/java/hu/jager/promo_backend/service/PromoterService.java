package hu.jager.promo_backend.service;

import hu.jager.promo_backend.entity.*;
import hu.jager.promo_backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class PromoterService {

    private final PrizePocketRepository prizePocketRepo;
    private final UserRepository userRepo;
    private final InventoryItemRepository inventoryRepo;
    private final AppSettingsRepository settingsRepo;

    // Előnézet beváltás ELŐTT — nem módosít semmit
    public PrizePocket previewPrize(String qrCodeHash) {
        PrizePocket pocket = prizePocketRepo.findByQrCodeHash(qrCodeHash)
                .orElseThrow(() -> new IllegalArgumentException("Érvénytelen QR kód!"));

        if (pocket.getStatus() == PrizePocket.Status.REDEEMED) {
            throw new IllegalStateException("Ezt a nyereményt már beváltották!");
        }

        return pocket;
    }

    // Tényleges beváltás — ITT történik a készlet levonása
    @Transactional
    public PrizePocket redeemPrize(String qrCodeHash, Long promoterId) {
        PrizePocket pocket = prizePocketRepo.findByQrCodeHash(qrCodeHash)
                .orElseThrow(() -> new IllegalArgumentException("Érvénytelen QR kód!"));

        if (pocket.getStatus() == PrizePocket.Status.REDEEMED) {
            throw new IllegalStateException("Ezt a nyereményt már beváltották!");
        }

        // Készlet ellenőrzés és levonás beváltáskor
        InventoryItem item = pocket.getInventoryItem();
        if (item != null) {
            if (item.getRemainingQuantity() <= 0) {
                // Elfogyott mire beváltotta — zseb törlése, játékos próbálkozhat újra
                throw new IllegalStateException(
                        "Ez a nyeremény már elfogyott! A kártyád frissül — próbálj újra játszani."
                );
            }
            item.setRemainingQuantity(item.getRemainingQuantity() - 1);
            inventoryRepo.save(item);
            log.info("Készlet levonva beváltáskor: {} → {} db maradt",
                    item.getName(), item.getRemainingQuantity());

            // Ha minden elfogy → esemény automatikusan offline
            checkAndStopEventIfEmpty();
        }

        AppUser promoter = userRepo.findById(promoterId).orElseThrow();
        pocket.setStatus(PrizePocket.Status.REDEEMED);
        pocket.setRedeemedAt(LocalDateTime.now());
        pocket.setRedeemedByPromoter(promoter);

        return prizePocketRepo.save(pocket);
    }

    // Ha minden item 0 → esemény leáll
    private void checkAndStopEventIfEmpty() {
        boolean anyLeft = inventoryRepo.findByRemainingQuantityGreaterThan(0)
                .stream()
                .anyMatch(i -> true);

        if (!anyLeft) {
            AppSettings settings = settingsRepo.findById(1L).orElse(null);
            if (settings != null && settings.isEventActive()) {
                settings.setEventActive(false);
                settingsRepo.save(settings);
                log.warn("Minden nyeremény elfogyott beváltáskor! Esemény automatikusan offline.");
            }
        }
    }
}
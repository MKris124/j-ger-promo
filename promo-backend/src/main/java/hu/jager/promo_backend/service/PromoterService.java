package hu.jager.promo_backend.service;

import hu.jager.promo_backend.entity.AppUser;
import hu.jager.promo_backend.entity.PrizePocket;
import hu.jager.promo_backend.repository.PrizePocketRepository;
import hu.jager.promo_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class PromoterService {

    private final PrizePocketRepository prizePocketRepo;
    private final UserRepository userRepo;

    @Transactional
    public PrizePocket redeemPrize(String qrCodeHash, Long promoterId) {
        // 1. Megkeressük a nyereményt a QR kód alapján
        PrizePocket pocket = prizePocketRepo.findByQrCodeHash(qrCodeHash)
                .orElseThrow(() -> new IllegalArgumentException("Érvénytelen QR kód!"));

        // 2. Ellenőrizzük, hogy nincs-e már beváltva (nehogy valaki screenshotot mutogasson)
        if (pocket.getStatus() == PrizePocket.Status.REDEEMED) {
            throw new IllegalStateException("Ezt a nyereményt már beváltották!");
        }

        // 3. Promóter azonosítása és a zseb lezárása
        AppUser promoter = userRepo.findById(promoterId).orElseThrow();

        pocket.setStatus(PrizePocket.Status.REDEEMED);
        pocket.setRedeemedAt(LocalDateTime.now());
        pocket.setRedeemedByPromoter(promoter);

        return prizePocketRepo.save(pocket);
    }
}
package hu.jager.promo_backend.controller;

import hu.jager.promo_backend.dto.RedeemRequest;
import hu.jager.promo_backend.entity.PrizePocket;
import hu.jager.promo_backend.service.PromoterService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/promoter")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class PromoterController {

    private final PromoterService promoterService;

    // QR kód beolvasása és nyeremény kiadása
    @PostMapping("/redeem")
    public ResponseEntity<?> redeemPrize(@RequestBody RedeemRequest request) {
        try {
            PrizePocket redeemedPocket = promoterService.redeemPrize(request.getQrCodeHash(), request.getPromoterId());
            return ResponseEntity.ok(redeemedPocket);
        } catch (IllegalStateException | IllegalArgumentException e) {
            // Ha már beváltották, vagy rossz a kód, piros hibaüzenet megy vissza
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
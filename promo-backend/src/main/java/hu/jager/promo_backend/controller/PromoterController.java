package hu.jager.promo_backend.controller;

import hu.jager.promo_backend.dto.PrizePocketDto;
import hu.jager.promo_backend.dto.RedeemRequest;
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

    // Előnézet — mutatja a nyereményt beváltás ELŐTT
    @GetMapping("/preview/{qrCodeHash}")
    public ResponseEntity<?> previewPrize(@PathVariable String qrCodeHash) {
        try {
            return ResponseEntity.ok(PrizePocketDto.from(promoterService.previewPrize(qrCodeHash)));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Tényleges beváltás
    @PostMapping("/redeem")
    public ResponseEntity<?> redeemPrize(@RequestBody RedeemRequest request) {
        try {
            return ResponseEntity.ok(PrizePocketDto.from(
                    promoterService.redeemPrize(request.getQrCodeHash(), request.getPromoterId())
            ));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
package hu.jager.promo_backend.controller;

import hu.jager.promo_backend.dto.ClaimPrizeRequest;
import hu.jager.promo_backend.dto.PlayGameRequest;
import hu.jager.promo_backend.entity.InventoryItem;
import hu.jager.promo_backend.entity.PrizePocket;
import hu.jager.promo_backend.service.GameService;
import hu.jager.promo_backend.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/game")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class GameController {

    private final GameService gameService;
    private final InventoryService inventoryService;

    // Játék eredményének elmentése
    @PostMapping("/play")
    public ResponseEntity<?> recordPlay(@RequestBody PlayGameRequest request) {
        try {
            gameService.recordPlayLog(request.getUserId(), request.getGameId(), request.isWinner());
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Elérhető nyeremények lekérdezése (A Busz játék végén listázza ki)
    @GetMapping("/available-prizes")
    public ResponseEntity<List<InventoryItem>> getAvailablePrizes() {
        return ResponseEntity.ok(inventoryService.getAvailablePrizes());
    }

    // Nyeremény kiválasztása és zsebbe rakása
    @PostMapping("/claim")
    public ResponseEntity<?> claimPrize(@RequestBody ClaimPrizeRequest request) {
        try {
            PrizePocket pocket = gameService.claimPrize(request.getUserId(), request.getInventoryItemId());
            return ResponseEntity.ok(pocket);
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
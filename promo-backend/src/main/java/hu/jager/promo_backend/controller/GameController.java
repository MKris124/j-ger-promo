package hu.jager.promo_backend.controller;

import hu.jager.promo_backend.dto.ClaimPrizeRequest;
import hu.jager.promo_backend.dto.PlayGameRequest;
import hu.jager.promo_backend.dto.PrizePocketDto;
import hu.jager.promo_backend.entity.AppSettings;
import hu.jager.promo_backend.entity.GameLog;
import hu.jager.promo_backend.entity.InventoryItem;
import hu.jager.promo_backend.entity.PrizePocket;
import hu.jager.promo_backend.service.AdminService;
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
    private final AdminService adminService;

    // Aktív játék lekérdezése (a frontend ebből tudja melyik komponenst töltse be)
    @GetMapping("/active")
    public ResponseEntity<?> getActiveGame() {
        AppSettings settings = adminService.getSettings();
        if (settings.getActiveGame() == null || !settings.getActiveGame().isActive()) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(settings.getActiveGame());
    }

    // Játék kör rögzítése + azonnali sorsolás nyerés esetén.
    @PostMapping("/play")
    public ResponseEntity<?> recordPlay(@RequestBody PlayGameRequest request) {
        try {
            PrizePocket pocket = gameService.recordPlayLog(
                    request.getUserId(),
                    request.getGameId(),
                    request.isWinner()
            );
            if (pocket == null) {
                // Vesztett — nincs nyeremény
                return ResponseEntity.noContent().build();
            }
            return ResponseEntity.ok(PrizePocketDto.from(pocket));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Elérhető nyeremények listája (Busz játékhoz — játékos maga választ)
    @GetMapping("/available-prizes")
    public ResponseEntity<List<InventoryItem>> getAvailablePrizes() {
        return ResponseEntity.ok(inventoryService.getAvailablePrizes());
    }

    // Közvetlen választás (Busz játék)
    @PostMapping("/claim")
    public ResponseEntity<?> claimPrize(@RequestBody ClaimPrizeRequest request) {
        try {
            PrizePocket pocket = gameService.claimPrize(
                    request.getUserId(),
                    request.getInventoryItemId()
            );
            return ResponseEntity.ok(PrizePocketDto.from(pocket));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Saját nyeremény zsebek
    @GetMapping("/my-pockets")
    public ResponseEntity<List<PrizePocketDto>> getMyPockets(@RequestParam Long userId) {
        return ResponseEntity.ok(
                gameService.getPocketsForUser(userId).stream()
                        .map(PrizePocketDto::from)
                        .toList()
        );
    }

    // Saját játék előzmények
    @GetMapping("/my-logs")
    public ResponseEntity<List<GameLog>> getMyLogs(@RequestParam Long userId) {
        return ResponseEntity.ok(gameService.getLogsForUser(userId));
    }
}
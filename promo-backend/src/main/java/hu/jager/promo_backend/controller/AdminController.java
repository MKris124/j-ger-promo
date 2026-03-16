package hu.jager.promo_backend.controller;

import hu.jager.promo_backend.dto.*;
import hu.jager.promo_backend.entity.AppSettings;
import hu.jager.promo_backend.entity.AppUser;
import hu.jager.promo_backend.entity.Game;
import hu.jager.promo_backend.service.AdminService;
import hu.jager.promo_backend.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class AdminController {

    private final AdminService adminService;
    private final InventoryService inventoryService;

    @GetMapping("/settings")
    public ResponseEntity<AppSettings> getSettings() {
        return ResponseEntity.ok(adminService.getSettings());
    }

    @PostMapping("/settings")
    public ResponseEntity<AppSettings> updateSettings(@RequestBody UpdateSettingsRequest req) {
        return ResponseEntity.ok(adminService.updateSettings(
                req.isEventActive(), req.getShotsPerLiter(), req.getActiveGameId(),
                req.getDrawMode(), req.getEventStart(), req.getEventEnd()
        ));
    }

    @GetMapping("/event-status")
    public ResponseEntity<Map<String, Boolean>> getEventStatus() {
        return ResponseEntity.ok(Map.of("eventActive", adminService.isEventCurrentlyActive()));
    }

    // ===================== JÁTÉKOK =====================

    @GetMapping("/games")
    public ResponseEntity<List<Game>> getAllGames() {
        return ResponseEntity.ok(adminService.getAllGames());
    }

    @PostMapping("/games")
    public ResponseEntity<Game> createGame(@RequestBody CreateGameRequest req) {
        return ResponseEntity.ok(adminService.createGame(
                req.getName(), req.getGameKey(), req.getDescription()
        ));
    }

    @PostMapping("/games/{gameId}/toggle")
    public ResponseEntity<Game> toggleGame(@PathVariable Long gameId) {
        try {
            return ResponseEntity.ok(adminService.toggleGame(gameId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/games/{gameId}")
    public ResponseEntity<?> deleteGame(@PathVariable Long gameId) {
        try {
            adminService.deleteGame(gameId);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ===================== KÉSZLET =====================

    @GetMapping("/inventory")
    public ResponseEntity<List<InventoryItemDto>> getAllInventory() {
        return ResponseEntity.ok(
                inventoryService.getAllItems().stream().map(InventoryItemDto::from).toList()
        );
    }

    @PostMapping("/inventory")
    public ResponseEntity<InventoryItemDto> createMerch(@RequestBody CreateMerchRequest req) {
        return ResponseEntity.ok(InventoryItemDto.from(
                inventoryService.createNewMerch(req.getName(), req.isLiquid())
        ));
    }

    @PostMapping("/inventory/{itemId}/add")
    public ResponseEntity<InventoryItemDto> addStock(@PathVariable Long itemId,
                                                     @RequestBody AddStockRequest req) {
        try {
            return ResponseEntity.ok(InventoryItemDto.from(inventoryService.addStock(itemId, req.getAddedQuantity())));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/inventory/{itemId}")
    public ResponseEntity<?> deleteInventoryItem(@PathVariable Long itemId) {
        try {
            inventoryService.deleteItem(itemId);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ===================== FELHASZNÁLÓK =====================

    @GetMapping("/users")
    public ResponseEntity<List<AppUser>> getAllUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @PostMapping("/users/{userId}/role")
    public ResponseEntity<?> changeRole(@PathVariable Long userId,
                                        @RequestBody ChangeRoleRequest req) {
        try {
            return ResponseEntity.ok(adminService.changeUserRole(userId, req.getRole()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
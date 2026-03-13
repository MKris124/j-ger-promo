package hu.jager.promo_backend.controller;

import hu.jager.promo_backend.dto.AddStockRequest;
import hu.jager.promo_backend.dto.ChangeRoleRequest;
import hu.jager.promo_backend.dto.CreateMerchRequest;
import hu.jager.promo_backend.dto.UpdateSettingsRequest;
import hu.jager.promo_backend.entity.AppSettings;
import hu.jager.promo_backend.entity.AppUser;
import hu.jager.promo_backend.entity.InventoryItem;
import hu.jager.promo_backend.service.AdminService;
import hu.jager.promo_backend.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class AdminController {

    private final AdminService adminService;
    private final InventoryService inventoryService;

    // --- BEÁLLÍTÁSOK ---

    @GetMapping("/settings")
    public ResponseEntity<AppSettings> getSettings() {
        return ResponseEntity.ok(adminService.getSettings());
    }

    @PostMapping("/settings")
    public ResponseEntity<AppSettings> updateSettings(@RequestBody UpdateSettingsRequest request) {
        return ResponseEntity.ok(adminService.updateSettings(request.isEventActive(), request.getShotsPerLiter()));
    }

    // --- KÉSZLET ---

    @PostMapping("/inventory/{itemId}/add")
    public ResponseEntity<InventoryItem> addStock(@PathVariable Long itemId, @RequestBody AddStockRequest request) {
        try {
            return ResponseEntity.ok(inventoryService.addStock(itemId, request.getAddedQuantity()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/inventory")
    public ResponseEntity<InventoryItem> createMerch(@RequestBody CreateMerchRequest request) {
        return ResponseEntity.ok(inventoryService.createNewMerch(request.getName(), request.isLiquid()));
    }

    // --- FELHASZNÁLÓK ÉS RANGOK ---

    @GetMapping("/users")
    public ResponseEntity<List<AppUser>> getAllUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @PostMapping("/users/{userId}/role")
    public ResponseEntity<?> changeRole(@PathVariable Long userId, @RequestBody ChangeRoleRequest request) {
        try {
            return ResponseEntity.ok(adminService.changeUserRole(userId, request.getRole()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
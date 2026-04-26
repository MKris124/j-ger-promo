package hu.jager.promo_backend.service;

import hu.jager.promo_backend.entity.AppSettings;
import hu.jager.promo_backend.entity.InventoryItem;
import hu.jager.promo_backend.repository.AppSettingsRepository;
import hu.jager.promo_backend.repository.InventoryItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryItemRepository inventoryRepo;
    private final AppSettingsRepository settingsRepo;

    // --- ADMIN: összes item listázása ---
    public List<InventoryItem> getAllItems() {
        // Csak a nem archivált (aktív) elemeket adjuk vissza a felületnek
        return inventoryRepo.findAll().stream().filter(item -> !item.isArchived()).toList();
    }

    // --- ADMIN: Raktárkészlet módosítása (Feltöltés ÉS Levonás) ---
    @Transactional
    public InventoryItem addStock(Long itemId, int addedQuantity) {
        InventoryItem item = inventoryRepo.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Nem létező tárgy!"));

        AppSettings settings = settingsRepo.findById(1L).orElseThrow();

        // Folyadék esetén literből adagot számolunk
        int actualQuantityToAdd = item.isLiquid()
                ? addedQuantity * settings.getShotsPerLiter()
                : addedQuantity;

        int newRemaining = item.getRemainingQuantity() + actualQuantityToAdd;
        int newTotal = item.getTotalQuantity() + actualQuantityToAdd;

        // Biztosítás, hogy ne vigyük be mínuszba a készletet
        item.setRemainingQuantity(Math.max(0, newRemaining));
        item.setTotalQuantity(Math.max(0, newTotal));

        return inventoryRepo.save(item);
    }

    // --- ADMIN: Új nyeremény létrehozása ---
    @Transactional
    public InventoryItem createNewMerch(String name, boolean isLiquid) {
        InventoryItem newItem = new InventoryItem();
        newItem.setName(name);
        newItem.setLiquid(isLiquid);
        newItem.setTotalQuantity(0);
        newItem.setRemainingQuantity(0);
        newItem.setArchived(false); // Biztos, ami biztos
        return inventoryRepo.save(newItem);
    }

    // --- ADMIN: Item törlése (SOFT DELETE) ---
    @Transactional
    public void deleteItem(Long itemId) {
        InventoryItem item = inventoryRepo.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Nem létező tárgy!"));

        // Tényleges törlés helyett csak archiváljuk, hogy a meglévő játékosok kártyáin ne omoljon össze a nyeremény
        item.setArchived(true);
        inventoryRepo.save(item);
    }

    // --- JÁTÉKOS: Elérhető nyeremények ---
    public List<InventoryItem> getAvailablePrizes() {
        return inventoryRepo.findByRemainingQuantityGreaterThan(0).stream()
                .filter(item -> !item.isArchived())
                .toList();
    }
}
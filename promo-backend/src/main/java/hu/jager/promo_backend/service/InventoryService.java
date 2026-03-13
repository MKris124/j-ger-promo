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

    // Admin funkció: Raktárkészlet növelése
    @Transactional
    public InventoryItem addStock(Long itemId, int addedQuantity) {
        InventoryItem item = inventoryRepo.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Nem létező tárgy!"));

        AppSettings settings = settingsRepo.findById(1L).orElseThrow();

        // Folyadék matek: Ha ital, felszorozzuk a liter/adag értékkel
        int actualQuantityToAdd = item.isLiquid() ? addedQuantity * settings.getShotsPerLiter() : addedQuantity;

        item.setTotalQuantity(item.getTotalQuantity() + actualQuantityToAdd);
        item.setRemainingQuantity(item.getRemainingQuantity() + actualQuantityToAdd);

        return inventoryRepo.save(item);
    }

    @Transactional
    public InventoryItem createNewMerch(String name, boolean isLiquid) {
        InventoryItem newItem = new InventoryItem();
        newItem.setName(name);
        newItem.setLiquid(isLiquid);
        newItem.setTotalQuantity(0);
        newItem.setRemainingQuantity(0);

        return inventoryRepo.save(newItem);
    }

    // Játékos funkció: Visszaadja azokat a tárgyakat, amikből Még Van készleten (A "Busz" játék végéhez)
    public List<InventoryItem> getAvailablePrizes() {
        return inventoryRepo.findByRemainingQuantityGreaterThan(0);
    }
}
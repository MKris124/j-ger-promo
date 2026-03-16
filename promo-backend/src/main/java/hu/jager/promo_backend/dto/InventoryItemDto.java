package hu.jager.promo_backend.dto;

import hu.jager.promo_backend.entity.InventoryItem;
import lombok.Data;

@Data
public class InventoryItemDto {
    private Long id;
    private String name;
    private boolean liquid;
    private int stock;         // remainingQuantity aliasa a frontendnek
    private int totalQuantity;

    public static InventoryItemDto from(InventoryItem item) {
        InventoryItemDto dto = new InventoryItemDto();
        dto.setId(item.getId());
        dto.setName(item.getName());
        dto.setLiquid(item.isLiquid());
        dto.setStock(item.getRemainingQuantity() != null ? item.getRemainingQuantity() : 0);
        dto.setTotalQuantity(item.getTotalQuantity() != null ? item.getTotalQuantity() : 0);
        return dto;
    }
}
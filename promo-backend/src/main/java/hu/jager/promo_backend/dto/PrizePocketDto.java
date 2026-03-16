package hu.jager.promo_backend.dto;

import hu.jager.promo_backend.entity.PrizePocket;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class PrizePocketDto {

    private Long id;
    private String qrCodeHash;
    private String status;          // "AVAILABLE" vagy "REDEEMED"
    private LocalDateTime wonAt;
    private LocalDateTime redeemedAt;

    // Nyeremény adatok
    private InventoryItemInfo inventoryItem;

    // Játékos neve (promoternek hasznos)
    private String userName;

    @Data
    public static class InventoryItemInfo {
        private Long id;
        private String name;
        private boolean liquid;
    }

    public static PrizePocketDto from(PrizePocket pocket) {
        PrizePocketDto dto = new PrizePocketDto();
        dto.setId(pocket.getId());
        dto.setQrCodeHash(pocket.getQrCodeHash());
        dto.setStatus(pocket.getStatus().name());
        dto.setWonAt(pocket.getWonAt());
        dto.setRedeemedAt(pocket.getRedeemedAt());

        if (pocket.getUser() != null) {
            dto.setUserName(pocket.getUser().getName());
        }

        if (pocket.getInventoryItem() != null) {
            InventoryItemInfo info = new InventoryItemInfo();
            info.setId(pocket.getInventoryItem().getId());
            info.setName(pocket.getInventoryItem().getName());
            info.setLiquid(pocket.getInventoryItem().isLiquid());
            dto.setInventoryItem(info);
        }

        return dto;
    }
}
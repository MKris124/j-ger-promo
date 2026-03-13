package hu.jager.promo_backend.dto;

import lombok.Data;

@Data
public class ClaimPrizeRequest {
    private Long userId;
    private Long inventoryItemId;
}
package hu.jager.promo_backend.dto;

import lombok.Data;

@Data
public class RedeemRequest {
    private Long promoterId;
    private String qrCodeHash;
}
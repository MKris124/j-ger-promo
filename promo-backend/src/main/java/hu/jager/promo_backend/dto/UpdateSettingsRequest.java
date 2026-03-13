package hu.jager.promo_backend.dto;

import lombok.Data;

@Data
public class UpdateSettingsRequest {
    private boolean eventActive;
    private Integer shotsPerLiter;
}
package hu.jager.promo_backend.dto;

import lombok.Data;

@Data
public class CreateMerchRequest {
    private String name;         // Pl. "Világító Szemüveg" vagy "Jäger Kemcső"
    private boolean isLiquid;    // true ha ital (literben számoljuk), false ha darabos merch
}
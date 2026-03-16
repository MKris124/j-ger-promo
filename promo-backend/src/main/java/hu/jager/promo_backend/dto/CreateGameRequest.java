package hu.jager.promo_backend.dto;

import lombok.Data;

@Data
public class CreateGameRequest {
    private String name;
    private String frontendComponentName;
    private String description;
}
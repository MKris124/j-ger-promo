package hu.jager.promo_backend.dto;

import hu.jager.promo_backend.entity.AppUser;
import lombok.Data;

@Data
public class AuthResponse {
    private Long id;
    private String email;
    private AppUser.Role role;
    private String token; // Ezt az új mezőt adtuk hozzá!

    // Kibővített konstruktor
    public AuthResponse(AppUser user, String token) {
        this.id = user.getId();
        this.email = user.getEmail();
        this.role = user.getRole();
        this.token = token;
    }
}
package hu.jager.promo_backend.dto;

import hu.jager.promo_backend.entity.AppUser;
import lombok.Data;

@Data
public class AuthResponse {
    private Long id;
    private String name;  // <-- EZT A MEZŐT HOZZÁADTUK!
    private String email;
    private AppUser.Role role;
    private String token;

    // Kibővített konstruktor
    public AuthResponse(AppUser user, String token) {
        this.id = user.getId();
        this.name = user.getName(); // <-- ÉS ITT IS KISZEDJÜK AZ ENTITÁSBÓL!
        this.email = user.getEmail();
        this.role = user.getRole();
        this.token = token;
    }
}
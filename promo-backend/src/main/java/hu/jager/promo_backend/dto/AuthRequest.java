package hu.jager.promo_backend.dto;

import lombok.Data;

@Data
public class AuthRequest {
    private String name; // EZ LEMARADT! Ezt várjuk a regisztrációnál
    private String email;
    private String password;
}
package hu.jager.promo_backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank(message = "A név megadása kötelező!")
    @Size(min = 2, max = 100, message = "A név legalább 2 karakter hosszú legyen!")
    private String name;

    @NotBlank(message = "Az e-mail cím megadása kötelező!")
    @Email(message = "Érvénytelen e-mail cím formátum!")
    private String email;

    @NotBlank(message = "A jelszó megadása kötelező!")
    @Size(min = 6, message = "A jelszónak legalább 6 karakter hosszúnak kell lennie!")
    private String password;
}

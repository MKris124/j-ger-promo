package hu.jager.promo_backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResetPasswordRequest {

    @NotBlank(message = "Az e-mail cím megadása kötelező!")
    @Email(message = "Érvénytelen e-mail cím formátum!")
    private String email;

    @NotBlank(message = "A kód megadása kötelező!")
    private String code;

    @NotBlank(message = "Az új jelszó megadása kötelező!")
    @Size(min = 6, message = "A jelszónak legalább 6 karakter hosszúnak kell lennie!")
    private String newPassword;
}

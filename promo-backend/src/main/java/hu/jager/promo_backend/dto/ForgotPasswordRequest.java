package hu.jager.promo_backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ForgotPasswordRequest {

    @NotBlank(message = "Az e-mail cím megadása kötelező!")
    @Email(message = "Érvénytelen e-mail cím formátum!")
    private String email;
}

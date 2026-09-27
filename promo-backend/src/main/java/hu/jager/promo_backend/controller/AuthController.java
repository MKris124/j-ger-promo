package hu.jager.promo_backend.controller;

import hu.jager.promo_backend.dto.AuthRequest;
import hu.jager.promo_backend.dto.AuthResponse;
import hu.jager.promo_backend.dto.GoogleLoginRequest;
import hu.jager.promo_backend.dto.RegisterRequest;
import hu.jager.promo_backend.dto.ResendCodeRequest;
import hu.jager.promo_backend.dto.VerifyEmailRequest;
import hu.jager.promo_backend.entity.AppSettings;
import hu.jager.promo_backend.entity.AppUser;
import hu.jager.promo_backend.security.JwtUtils; // Ezt importáljuk!
import hu.jager.promo_backend.service.AdminService;
import hu.jager.promo_backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtUtils jwtUtils;
    private final AdminService adminService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        try {
            // Nincs azonnali token — a fiók csak az e-mailben kapott kód beküldése után használható
            AppUser user = authService.register(request.getEmail(), request.getPassword(), request.getName());
            return ResponseEntity.ok(Map.of(
                    "message", "Elküldtük a megerősítő kódot az e-mail címedre!",
                    "email", user.getEmail()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/verify-email")
    public ResponseEntity<?> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        try {
            AppUser user = authService.verifyEmail(request.getEmail(), request.getCode());
            String token = jwtUtils.generateToken(user);
            return ResponseEntity.ok(new AuthResponse(user, token));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/resend-code")
    public ResponseEntity<?> resendCode(@Valid @RequestBody ResendCodeRequest request) {
        try {
            authService.resendVerificationCode(request.getEmail());
            return ResponseEntity.ok(Map.of("message", "Új kódot küldtünk az e-mail címedre!"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthRequest request) {
        try {
            AppUser user = authService.login(request.getEmail(), request.getPassword());
            String token = jwtUtils.generateToken(user); // TOKEN GENERÁLÁSA
            return ResponseEntity.ok(new AuthResponse(user, token)); // ÁTADJUK A DTO-NAK
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/google")
    public ResponseEntity<?> loginWithGoogle(@RequestBody GoogleLoginRequest request) {
        try {
            AppUser user = authService.loginWithGoogle(request.getToken());
            String token = jwtUtils.generateToken(user); // TOKEN GENERÁLÁSA
            return ResponseEntity.ok(new AuthResponse(user, token)); // ÁTADJUK A DTO-NAK
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/event-status")
    public ResponseEntity<?> getEventStatus() {
        AppSettings settings = adminService.getSettings();
        return ResponseEntity.ok(Map.of("eventActive", adminService.isEventCurrentlyActive()));
    }

    @GetMapping("/refresh")
    public ResponseEntity<?> refreshToken() {
        Authentication auth =
                SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !(auth.getPrincipal() instanceof AppUser user)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Nincs bejelentkezve");
        }

        String newToken = jwtUtils.generateToken(user);

        return ResponseEntity.ok(Map.of(
                "token", newToken,
                "name", user.getName(),
                "role", user.getRole().name(),
                "id", user.getId()
        ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getDefaultMessage())
                .orElse("Érvénytelen adatok!");
        return ResponseEntity.badRequest().body(message);
    }
}
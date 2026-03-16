package hu.jager.promo_backend.controller;

import hu.jager.promo_backend.dto.AuthRequest;
import hu.jager.promo_backend.dto.AuthResponse;
import hu.jager.promo_backend.dto.GoogleLoginRequest;
import hu.jager.promo_backend.entity.AppSettings;
import hu.jager.promo_backend.entity.AppUser;
import hu.jager.promo_backend.security.JwtUtils; // Ezt importáljuk!
import hu.jager.promo_backend.service.AdminService;
import hu.jager.promo_backend.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class AuthController {

    private final AuthService authService;
    private final JwtUtils jwtUtils;
    private final AdminService adminService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody AuthRequest request) {
        try {
            // Itt adjuk át a request.getName()-et is a Service-nek!
            AppUser user = authService.register(request.getEmail(), request.getPassword(), request.getName());
            String token = jwtUtils.generateToken(user);
            return ResponseEntity.ok(new AuthResponse(user, token));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
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
        return ResponseEntity.ok(Map.of("eventActive", settings.isEventActive()));
    }
}
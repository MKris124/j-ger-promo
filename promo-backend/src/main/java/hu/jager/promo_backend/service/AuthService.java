package hu.jager.promo_backend.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import hu.jager.promo_backend.entity.AppUser;
import hu.jager.promo_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    // FONTOS: Ezt majd a Google Cloud Console-ban kapott azonosítóra kell cserélned!
    // (Ugyanezt az ID-t fogja használni az Angular frontend is).
    private static final String GOOGLE_CLIENT_ID = "567887725034-56lg9t1s9rplp8q572v48697qmh76pfg.apps.googleusercontent.com";

    // --- 1. HAGYOMÁNYOS (E-MAIL + JELSZÓ) REGISZTRÁCIÓ ---
    @Transactional
    public AppUser register(String email, String rawPassword) {
        if (userRepo.existsByEmail(email)) {
            throw new IllegalArgumentException("Ez az e-mail cím már regisztrálva van!");
        }

        AppUser user = new AppUser();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(rawPassword)); // Jelszó titkosítása BCrypt-tel
        user.setRole(AppUser.Role.USER); // Alapértelmezett rang
        user.setProvider(AppUser.AuthProvider.LOCAL); // Hagyományos regisztráció

        return userRepo.save(user);
    }

    // --- 2. HAGYOMÁNYOS BELÉPÉS ---
    public AppUser login(String email, String rawPassword) {
        AppUser user = userRepo.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Hibás e-mail vagy jelszó!"));

        // Ha a felhasználó Google-lel regisztrált, de most jelszóval próbál belépni
        if (user.getProvider() == AppUser.AuthProvider.GOOGLE || user.getPasswordHash() == null) {
            throw new IllegalArgumentException("Ezzel az e-mail címmel Google fiókon keresztül regisztráltál. Kérlek, használd a Google belépést!");
        }

        // Jelszó ellenőrzése
        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("Hibás e-mail vagy jelszó!");
        }

        return user;
    }

    // --- 3. GOOGLE BELÉPÉS / AUTOMATIKUS REGISZTRÁCIÓ ---
    @Transactional
    public AppUser loginWithGoogle(String googleIdTokenString) throws Exception {
        // 1. Google Token ellenőrző felépítése
        GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                .setAudience(Collections.singletonList(GOOGLE_CLIENT_ID))
                .build();

        // 2. Token validálása (Leellenőrzi a Google szerverein, hogy tényleg érvényes-e)
        GoogleIdToken idToken = verifier.verify(googleIdTokenString);
        if (idToken == null) {
            throw new IllegalArgumentException("Érvénytelen vagy lejárt Google token!");
        }

        // 3. Adatok kinyerése a biztonságos tokenből
        GoogleIdToken.Payload payload = idToken.getPayload();
        String email = payload.getEmail();

        // 4. Megnézzük, létezik-e már a felhasználó
        Optional<AppUser> existingUser = userRepo.findByEmail(email);

        if (existingUser.isPresent()) {
            AppUser user = existingUser.get();
            // Ha létezik, de eredetileg jelszóval regisztrált, rászólunk, hogy használja azt
            // (Vagy akár össze is vonhatod a fiókokat, de ez a biztonságosabb út)
            if (user.getProvider() == AppUser.AuthProvider.LOCAL) {
                throw new IllegalArgumentException("Ez az e-mail cím már regisztrálva van hagyományos módon. Kérlek, lépj be a jelszavaddal!");
            }
            return user; // Sikeres belépés Google-lel
        } else {
            // 5. Ha még nem létezik, automatikusan beregisztráljuk
            AppUser newUser = new AppUser();
            newUser.setEmail(email);
            newUser.setRole(AppUser.Role.USER); // Szintén alapértelmezett rang
            newUser.setProvider(AppUser.AuthProvider.GOOGLE);
            // Jelszó mező üresen marad, mert a Google azonosítja

            return userRepo.save(newUser);
        }
    }
}
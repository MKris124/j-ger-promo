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

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    private static final SecureRandom CODE_RANDOM = new SecureRandom();
    private static final long CODE_VALIDITY_MINUTES = 15;

    // FONTOS: Ezt majd a Google Cloud Console-ban kapott azonosítóra kell cserélned!
    // (Ugyanezt az ID-t fogja használni az Angular frontend is).
    private static final String GOOGLE_CLIENT_ID = "567887725034-56lg9t1s9rplp8q572v48697qmh76pfg.apps.googleusercontent.com";

    // Csak egyszer épül fel (HTTP transport + JSON factory) — nem minden Google belépésnél újra
    private final GoogleIdTokenVerifier googleVerifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
            .setAudience(Collections.singletonList(GOOGLE_CLIENT_ID))
            .build();

    // --- 1. HAGYOMÁNYOS (E-MAIL + JELSZÓ) REGISZTRÁCIÓ ---
    @Transactional
    public AppUser register(String email, String rawPassword, String name) { // <-- Itt a név paraméter
        if (userRepo.existsByEmail(email)) {
            throw new IllegalArgumentException("Ez az e-mail cím már regisztrálva van!");
        }

        AppUser user = new AppUser();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setName(name); // <-- EZT ADTUK HOZZÁ! Mentsük el az adatbázisba!
        user.setRole(AppUser.Role.USER);
        user.setProvider(AppUser.AuthProvider.LOCAL);
        user.setEmailVerified(false);
        user.setVerificationCode(generateVerificationCode());
        user.setVerificationCodeExpiresAt(LocalDateTime.now().plusMinutes(CODE_VALIDITY_MINUTES));

        AppUser saved = userRepo.save(user);

        // Ha a küldés hibázik, ez az egész tranzakció (a user mentése is) visszagördül —
        // nem maradhat fenn egy user, aki sosem kapja meg a kódot
        emailService.sendVerificationCode(saved.getEmail(), saved.getName(), saved.getVerificationCode());

        return saved;
    }

    // --- E-MAIL MEGERŐSÍTÉS ---
    @Transactional
    public AppUser verifyEmail(String email, String code) {
        AppUser user = userRepo.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Nincs ilyen felhasználó!"));

        if (Boolean.TRUE.equals(user.getEmailVerified())) {
            return user; // már meg van erősítve — idempotens
        }

        if (user.getVerificationCode() == null
                || user.getVerificationCodeExpiresAt() == null
                || user.getVerificationCodeExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("A kód lejárt vagy érvénytelen. Kérj egy újat!");
        }

        if (!user.getVerificationCode().equals(code)) {
            throw new IllegalArgumentException("Hibás megerősítő kód!");
        }

        user.setEmailVerified(true);
        user.setVerificationCode(null);
        user.setVerificationCodeExpiresAt(null);
        return userRepo.save(user);
    }

    @Transactional
    public void resendVerificationCode(String email) {
        AppUser user = userRepo.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Nincs ilyen felhasználó!"));

        if (Boolean.TRUE.equals(user.getEmailVerified())) {
            throw new IllegalArgumentException("Ez a fiók már meg van erősítve!");
        }

        user.setVerificationCode(generateVerificationCode());
        user.setVerificationCodeExpiresAt(LocalDateTime.now().plusMinutes(CODE_VALIDITY_MINUTES));
        userRepo.save(user);

        emailService.sendVerificationCode(user.getEmail(), user.getName(), user.getVerificationCode());
    }

    private String generateVerificationCode() {
        return String.format("%06d", CODE_RANDOM.nextInt(1_000_000));
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

        // Csak a funkció bevezetése UTÁN regisztráltakat zárjuk ki (explicit false) —
        // a régebbi usereknél emailVerified még null, azokat nem zárjuk ki utólag
        if (Boolean.FALSE.equals(user.getEmailVerified())) {
            throw new IllegalArgumentException("Kérlek, erősítsd meg az e-mail címed a kapott kóddal, mielőtt belépnél!");
        }

        return user;
    }

    // --- 3. GOOGLE BELÉPÉS / AUTOMATIKUS REGISZTRÁCIÓ ---
    @Transactional
    public AppUser loginWithGoogle(String googleIdTokenString) throws Exception {
        // Token validálása (Leellenőrzi a Google szerverein, hogy tényleg érvényes-e)
        GoogleIdToken idToken = googleVerifier.verify(googleIdTokenString);
        if (idToken == null) {
            throw new IllegalArgumentException("Érvénytelen vagy lejárt Google token!");
        }

        // 3. Adatok kinyerése a biztonságos tokenből
        GoogleIdToken.Payload payload = idToken.getPayload();
        String email = payload.getEmail();
        String name = (String) payload.get("name");

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
            newUser.setName(name);
            newUser.setRole(AppUser.Role.USER); // Szintén alapértelmezett rang
            newUser.setProvider(AppUser.AuthProvider.GOOGLE);
            newUser.setEmailVerified(true); // A Google már ellenőrizte az e-mail címet
            // Jelszó mező üresen marad, mert a Google azonosítja

            return userRepo.save(newUser);
        }
    }
}
package hu.jager.promo_backend.security;

import hu.jager.promo_backend.entity.AppUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Component
public class JwtUtils {

    // FONTOS: Ez a rendszer mesterkulcsa (Legalább 256 bitesnek kell lennie).
    // Ezzel írjuk alá a tokeneket. Ha ezt valaki megszerzi, hamisíthat magának tokent.
    private static final String SECRET = "JagerPromoBuliFesztivalTitkosKulcs2026SzuperBiztonsagos";

    // Meddig érvényes a belépés? (1000 ms * 60 mp * 60 perc * 24 óra = 1 nap)
    private static final long EXPIRATION_TIME = 1000 * 60 * 60 * 24;

    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(SECRET.getBytes());
    }

    // 1. Token generálása sikeres belépés után
    public String generateToken(AppUser user) {
        return Jwts.builder()
                .setSubject(user.getEmail()) // Fő azonosító
                .claim("id", user.getId())   // Beletesszük az ID-t is, hogy a frontend tudja
                .claim("role", user.getRole().name()) // Beletesszük a rangot
                .setIssuedAt(new Date(System.currentTimeMillis())) // Kiállítás ideje
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME)) // Lejárat
                .signWith(getSigningKey(), SignatureAlgorithm.HS256) // Titkosítás a mesterkulccsal
                .compact();
    }

    // 2. E-mail cím kinyerése a tokenből
    public String extractEmail(String token) {
        return getClaims(token).getSubject();
    }

    // 3. Érvényes-e még a token, és mi írtuk-e alá?
    public boolean validateToken(String token) {
        try {
            getClaims(token); // Ha ez nem dob hibát, akkor a token hibátlan
            return true;
        } catch (Exception e) {
            return false; // Lejárt, hamisított, vagy sérült
        }
    }

    // Segédfüggvény a token visszafejtéséhez
    private Claims getClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
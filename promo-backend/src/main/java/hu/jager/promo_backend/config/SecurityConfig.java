package hu.jager.promo_backend.config;

import hu.jager.promo_backend.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.Customizer;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(); // Jelenleg a BCrypt az iparági standard jelszavakhoz
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable) // API-knál ez felesleges
                .cors(Customizer.withDefaults()) // Angular CORS engedélyezése
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)) // Nincs Session, csak JWT
                .authorizeHttpRequests(auth -> auth
                        // Publikus végpontok (Bárki elérheti)
                        .requestMatchers("/api/auth/**", "/h2-console/**").permitAll()

                        // Védett végpontok rangok szerint
                        .requestMatchers("/api/admin/**").hasAuthority("ADMIN") // Csak admin
                        .requestMatchers("/api/promoter/**").hasAnyAuthority("PROMOTER", "ADMIN") // Pultos vagy Admin
                        .requestMatchers("/api/game/**").hasAnyAuthority("USER", "PROMOTER", "ADMIN") // Bárki, aki be van lépve

                        .anyRequest().authenticated()
                )
                // H2 adatbázis konzol megjelenítéséhez kell
                .headers(headers -> headers.frameOptions(HeadersConfigurer.FrameOptionsConfig::disable))

                // Beillesztjük a saját JWT szűrőnket a Spring gyári szűrője elé!
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
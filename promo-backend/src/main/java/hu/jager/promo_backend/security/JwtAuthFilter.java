package hu.jager.promo_backend.security;

import hu.jager.promo_backend.entity.AppUser;
import hu.jager.promo_backend.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtils jwtUtils;
    private final UserRepository userRepo;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // 1. Kiszedjük a fejlécből a tokent (Authorization: Bearer <token>)
        final String authHeader = request.getHeader("Authorization");
        final String jwt;
        final String userEmail;

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        jwt = authHeader.substring(7); // Levágjuk a "Bearer " szót

        // 2. Ellenőrizzük a tokent és kinyerjük az e-mailt
        if (jwtUtils.validateToken(jwt)) {
            userEmail = jwtUtils.extractEmail(jwt);

            // 3. Ha érvényes, és a Spring még nem léptette be a folyamatban
            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                AppUser user = userRepo.findByEmail(userEmail).orElse(null);

                if (user != null) {
                    // Átadjuk a Spring Security-nek a felhasználót és a RANGJÁT!
                    SimpleGrantedAuthority authority = new SimpleGrantedAuthority(user.getRole().name());

                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            user, null, Collections.singletonList(authority)
                    );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    // Beléptetjük a rendszerszinten!
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        }
        filterChain.doFilter(request, response);
    }
}
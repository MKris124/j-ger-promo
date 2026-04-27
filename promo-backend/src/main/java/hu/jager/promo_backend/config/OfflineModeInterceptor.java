package hu.jager.promo_backend.config;

import hu.jager.promo_backend.service.SettingsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Objects;

@Component
public class OfflineModeInterceptor implements HandlerInterceptor {

    @Autowired
    private SettingsService settingsService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String uri = request.getRequestURI();

        // Csak a védett API végpontokat vizsgáljuk
        if (uri.startsWith("/api/") && !uri.startsWith("/api/auth/") && !uri.startsWith("/api/settings/public")) {

            Authentication auth = SecurityContextHolder.getContext().getAuthentication();

            // Ha a felhasználó egy "sima" játékos
            if (auth != null && auth.getAuthorities().stream().anyMatch(a -> Objects.equals(a.getAuthority(), "USER"))) {

                // Használjuk a tiszta Service hívást az adatbázis turkálás helyett
                if (settingsService.isEventOffline()) {
                    response.sendError(HttpServletResponse.SC_FORBIDDEN, "Az esemény jelenleg offline.");
                    return false; // Kérés megállítva!
                }
            }
        }
        return true;
    }
}
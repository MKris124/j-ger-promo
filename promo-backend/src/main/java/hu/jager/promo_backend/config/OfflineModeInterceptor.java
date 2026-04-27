package hu.jager.promo_backend.config;

import hu.jager.promo_backend.service.SettingsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Objects;

@Component
@RequiredArgsConstructor
public class OfflineModeInterceptor implements HandlerInterceptor {

    private final SettingsService settingsService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String uri = request.getRequestURI();

        if (uri.startsWith("/api/") && !uri.startsWith("/api/auth/") && !uri.startsWith("/api/settings/public")) {

            Authentication auth = SecurityContextHolder.getContext().getAuthentication();

            if (auth != null && auth.getAuthorities().stream().anyMatch(a -> Objects.equals(a.getAuthority(), "USER"))) {

                if (settingsService.isEventOffline()) {
                    response.sendError(HttpServletResponse.SC_FORBIDDEN, "Az esemény jelenleg offline.");
                    return false;
                }
            }
        }
        return true;
    }
}
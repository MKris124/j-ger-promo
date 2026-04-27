package hu.jager.promo_backend.controller;

import hu.jager.promo_backend.service.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService settingsService;

    @GetMapping("/public")
    public ResponseEntity<Map<String, Boolean>> getPublicSettings() {
        boolean isOffline = settingsService.isEventOffline();

        return ResponseEntity.ok(Map.of("isOffline", isOffline));
    }
}
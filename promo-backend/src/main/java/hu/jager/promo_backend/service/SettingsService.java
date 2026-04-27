package hu.jager.promo_backend.service;

import hu.jager.promo_backend.entity.AppSettings;
import hu.jager.promo_backend.repository.AppSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SettingsService {

    private final AppSettingsRepository settingsRepo;

    public boolean isEventOffline() {
        AppSettings settings = settingsRepo.findById(1L).orElse(null);
        return settings != null && settings.isEventActive();
    }
}
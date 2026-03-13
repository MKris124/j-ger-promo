package hu.jager.promo_backend.service;

import hu.jager.promo_backend.entity.AppSettings;
import hu.jager.promo_backend.entity.AppUser;
import hu.jager.promo_backend.repository.AppSettingsRepository;
import hu.jager.promo_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final AppSettingsRepository settingsRepo;
    private final UserRepository userRepo; // Ezt adtuk hozzá a rangok miatt

    // --- BEÁLLÍTÁSOK KEZELÉSE ---

    public AppSettings getSettings() {
        return settingsRepo.findById(1L).orElseGet(() -> {
            AppSettings defaultSettings = new AppSettings();
            return settingsRepo.save(defaultSettings);
        });
    }

    @Transactional
    public AppSettings updateSettings(boolean isEventActive, Integer shotsPerLiter) {
        AppSettings settings = getSettings();
        settings.setEventActive(isEventActive);

        if (shotsPerLiter != null && shotsPerLiter > 0) {
            settings.setShotsPerLiter(shotsPerLiter);
        }

        return settingsRepo.save(settings);
    }

    // --- FELHASZNÁLÓK ÉS RANGOK KEZELÉSE ---

    // Kilistázza az összes usert az Admin felület táblázatához
    public List<AppUser> getAllUsers() {
        return userRepo.findAll();
    }

    // Rang megváltoztatása (Pl. kinevezünk egy pultost Promóternek)
    @Transactional
    public AppUser changeUserRole(Long targetUserId, AppUser.Role newRole) {
        AppUser user = userRepo.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("A felhasználó nem található!"));

        user.setRole(newRole);
        return userRepo.save(user);
    }
}
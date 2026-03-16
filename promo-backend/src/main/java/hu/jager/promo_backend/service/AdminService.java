package hu.jager.promo_backend.service;

import hu.jager.promo_backend.entity.*;
import hu.jager.promo_backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final AppSettingsRepository settingsRepo;
    private final UserRepository userRepo;
    private final GameRepository gameRepo;
    private final DrawService drawService;

    // ===================== SETTINGS =====================

    public AppSettings getSettings() {
        return settingsRepo.findById(1L).orElseGet(() -> {
            AppSettings defaults = new AppSettings();
            return settingsRepo.save(defaults);
        });
    }

    public boolean isEventCurrentlyActive() {
        AppSettings s = getSettings();
        LocalDateTime now = LocalDateTime.now();

        if (s.getEventStart() != null && s.getEventEnd() != null) {
            return now.isAfter(s.getEventStart()) && now.isBefore(s.getEventEnd());
        }
        return s.isEventActive();
    }

    @Transactional
    public AppSettings updateSettings(boolean isEventActive,
                                      Integer shotsPerLiter,
                                      Long activeGameId,
                                      String drawMode,
                                      LocalDateTime eventStart,
                                      LocalDateTime eventEnd) {
        AppSettings settings = getSettings();
        boolean wasActive = settings.isEventActive();

        settings.setEventActive(isEventActive);

        if (shotsPerLiter != null && shotsPerLiter > 0) {
            settings.setShotsPerLiter(shotsPerLiter);
        }

        if (drawMode != null && (drawMode.equals("TIMED") || drawMode.equals("PERCENTAGE"))) {
            settings.setDrawMode(drawMode);
        }

        // Időzítés beállítása
        if (eventStart != null && eventEnd != null && eventEnd.isAfter(eventStart)) {
            settings.setEventStart(eventStart);
            settings.setEventEnd(eventEnd);
        } else if (eventStart == null && eventEnd == null) {
            settings.setEventStart(null);
            settings.setEventEnd(null);
        }

        // Aktív játék
        if (activeGameId != null) {
            Game game = gameRepo.findById(activeGameId)
                    .orElseThrow(() -> new IllegalArgumentException("Nem létező játék!"));
            settings.setActiveGame(game);
        }

        // Manuális mód: ha most kapcsolták BE → mentsük az időpontot
        if (!wasActive && isEventActive && settings.getEventStart() == null) {
            settings.setActivatedAt(LocalDateTime.now());
            log.info("Esemény manuálisan bekapcsolva: {}", settings.getActivatedAt());
        }

        AppSettings saved = settingsRepo.save(settings);

        // TIMED mód + van start/end → automatikusan generáljuk a nyerő pillanatokat
        if ("TIMED".equals(saved.getDrawMode())
                && saved.getEventStart() != null
                && saved.getEventEnd() != null) {
            int generated = drawService.generateWinningMoments(saved.getEventStart(), saved.getEventEnd());
            log.info("Nyerő pillanatok újragenerálva: {} db", generated);
        }

        return saved;
    }

    // ===================== GAMES =====================

    public List<Game> getAllGames() {
        return gameRepo.findAll();
    }

    @Transactional
    public Game createGame(String name, String frontendComponentName, String description) {
        Game game = new Game();
        game.setName(name);
        game.setFrontendComponentName(frontendComponentName);
        game.setDescription(description);
        game.setActive(true);
        return gameRepo.save(game);
    }

    @Transactional
    public Game toggleGame(Long gameId) {
        Game game = gameRepo.findById(gameId)
                .orElseThrow(() -> new IllegalArgumentException("Nem létező játék!"));
        game.setActive(!game.isActive());
        return gameRepo.save(game);
    }

    // ===================== USERS =====================

    public List<AppUser> getAllUsers() {
        return userRepo.findAll();
    }

    @Transactional
    public AppUser changeUserRole(Long targetUserId, AppUser.Role newRole) {
        AppUser user = userRepo.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("A felhasználó nem található!"));
        user.setRole(newRole);
        return userRepo.save(user);
    }
}
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
    private final PrizePocketRepository prizePocketRepo;

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
        Long prevGameId = settings.getActiveGame() != null ? settings.getActiveGame().getId() : null;

        settings.setEventActive(isEventActive);

        if (shotsPerLiter != null && shotsPerLiter > 0) {
            settings.setShotsPerLiter(shotsPerLiter);
        }

        if (drawMode != null && (drawMode.equals("TIMED") || drawMode.equals("PERCENTAGE"))) {
            settings.setDrawMode(drawMode);
        }

        if (eventStart != null && eventEnd != null && eventEnd.isAfter(eventStart)) {
            settings.setEventStart(eventStart);
            settings.setEventEnd(eventEnd);
        } else if (eventStart == null && eventEnd == null) {
            settings.setEventStart(null);
            settings.setEventEnd(null);
        }

        if (activeGameId != null) {
            Game game = gameRepo.findById(activeGameId)
                    .orElseThrow(() -> new IllegalArgumentException("Nem létező játék!"));
            settings.setActiveGame(game);

            if (prevGameId != null && !prevGameId.equals(activeGameId)) {
                // Játékváltáskor MINDEN zseb törlődik — beváltottak sem relevánsak már
                prizePocketRepo.deleteAllPockets();
                log.info("Játék váltás: összes zseb törölve");
            }
        }

        // Esemény BE → zsebek törlése + activatedAt mentése
        if (!wasActive && isEventActive) {
            settings.setActivatedAt(LocalDateTime.now());
            int deleted = prizePocketRepo.deleteAllNotRedeemed();
            log.info("Esemény bekapcsolva: {} zseb törölve", deleted);
        }

        // Esemény KI → zsebek törlése
        if (wasActive && !isEventActive) {
            int deleted = prizePocketRepo.deleteAllNotRedeemed();
            log.info("Esemény leállítva: {} zseb törölve", deleted);
        }

        AppSettings saved = settingsRepo.save(settings);

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
    public Game createGame(String name, String gameKey, String description) {
        Game game = new Game();
        game.setName(name);
        game.setGameKey(gameKey);
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

    @Transactional
    public void deleteGame(Long gameId) {
        Game game = gameRepo.findById(gameId)
                .orElseThrow(() -> new IllegalArgumentException("Nem létező játék!"));

        // Ha ez az aktív játék, töröljük az aktív játék referenciát
        AppSettings settings = getSettings();
        if (settings.getActiveGame() != null && settings.getActiveGame().getId().equals(gameId)) {
            settings.setActiveGame(null);
            settingsRepo.save(settings);
        }

        gameRepo.delete(game);
        log.info("Játék törölve: {}", game.getName());
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
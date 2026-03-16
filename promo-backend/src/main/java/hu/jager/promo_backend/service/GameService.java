package hu.jager.promo_backend.service;

import hu.jager.promo_backend.entity.*;
import hu.jager.promo_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GameService {

    private final GameLogRepository gameLogRepo;
    private final PrizePocketRepository prizePocketRepo;
    private final InventoryItemRepository inventoryRepo;
    private final UserRepository userRepo;
    private final GameRepository gameRepo;
    private final DrawService drawService;

    /**
     * Játék kör rögzítése.
     * Ha nyert → sorsolás → PrizePocket létrehozása.
     * Ha vesztett → csak log.
     * Visszaadja a PrizePocket-et (nyerés esetén) vagy null-t.
     */
    @Transactional
    public PrizePocket recordPlayLog(Long userId, Long gameId, boolean isWinner) {
        AppUser user = userRepo.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Felhasználó nem található!"));

        Game game = gameRepo.findById(gameId)
                .orElseThrow(() -> new IllegalArgumentException("Játék nem található!"));

        // Log mentése
        GameLog log = new GameLog();
        log.setUser(user);
        log.setGameName(game.getName());
        log.setWinner(isWinner);
        log.setPlayedAt(LocalDateTime.now());
        // inventoryItem-et nyerés után állítjuk be

        if (!isWinner) {
            gameLogRepo.save(log);
            return null;
        }

        // Max 2 nyeremény ellenőrzése
        long currentPrizes = prizePocketRepo.countByUserIdAndStatus(userId, PrizePocket.Status.AVAILABLE);
        if (currentPrizes >= 2) {
            throw new IllegalStateException("Mára kimaxoltad a Jäger élményt!");
        }

        // Sorsolás
        InventoryItem won = drawService.draw(user);

        if (won == null) {
            gameLogRepo.save(log);
            throw new IllegalStateException("Minden nyeremény elfogyott az estére!");
        }

        // Log-ba mentjük mit nyert
        log.setInventoryItem(won);
        gameLogRepo.save(log);

        // PrizePocket létrehozása
        PrizePocket pocket = new PrizePocket();
        pocket.setUser(user);
        pocket.setInventoryItem(won);
        pocket.setQrCodeHash(UUID.randomUUID().toString());
        pocket.setStatus(PrizePocket.Status.AVAILABLE);

        return prizePocketRepo.save(pocket);
    }

    /**
     * Meglévő /claim flow — a Busz játékhoz (ha a játékos maga választ).
     * Ez NEM használja a DrawService-t, közvetlen választás.
     */
    @Transactional
    public PrizePocket claimPrize(Long userId, Long inventoryItemId) {
        long currentPrizes = prizePocketRepo.countByUserIdAndStatus(userId, PrizePocket.Status.AVAILABLE);
        if (currentPrizes >= 2) {
            throw new IllegalStateException("Már elérted a maximális 2 nyereményt a mai napra!");
        }

        InventoryItem item = inventoryRepo.findById(inventoryItemId).orElseThrow();
        if (item.getRemainingQuantity() <= 0) {
            throw new IllegalStateException("Hoppá, erről pont lecsúsztál! Kérlek, válassz mást!");
        }



        AppUser user = userRepo.findById(userId).orElseThrow();
        PrizePocket pocket = new PrizePocket();
        pocket.setUser(user);
        pocket.setInventoryItem(item);
        pocket.setQrCodeHash(UUID.randomUUID().toString());
        pocket.setStatus(PrizePocket.Status.AVAILABLE);

        return prizePocketRepo.save(pocket);
    }

    public List<PrizePocket> getPocketsForUser(Long userId) {
        return prizePocketRepo.findAllByUserId(userId);
    }

    public List<GameLog> getLogsForUser(Long userId) {
        return gameLogRepo.findByUserIdOrderByPlayedAtDesc(userId);
    }
}
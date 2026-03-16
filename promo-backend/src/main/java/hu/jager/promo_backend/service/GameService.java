package hu.jager.promo_backend.service;

import hu.jager.promo_backend.entity.*;
import hu.jager.promo_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        gameLogRepo.save(log);

        if (!isWinner) return null;

        // Max 2 nyeremény ellenőrzése
        long currentPrizes = prizePocketRepo.countByUserId(userId);
        if (currentPrizes >= 2) {
            throw new IllegalStateException("Mára kimaxoltad a Jäger élményt!");
        }

        // Sorsolás
        InventoryItem won = drawService.draw(user);

        if (won == null) {
            // Minden elfogyott — DrawService már leállította az eseményt
            throw new IllegalStateException("Minden nyeremény elfogyott az estére!");
        }

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
        long currentPrizes = prizePocketRepo.countByUserId(userId);
        if (currentPrizes >= 2) {
            throw new IllegalStateException("Már elérted a maximális 2 nyereményt a mai napra!");
        }

        InventoryItem item = inventoryRepo.findById(inventoryItemId).orElseThrow();
        if (item.getRemainingQuantity() <= 0) {
            throw new IllegalStateException("Hoppá, erről pont lecsúsztál! Kérlek, válassz mást!");
        }

        item.setRemainingQuantity(item.getRemainingQuantity() - 1);
        inventoryRepo.save(item);

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
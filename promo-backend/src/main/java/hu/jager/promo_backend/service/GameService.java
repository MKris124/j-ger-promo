package hu.jager.promo_backend.service;

import hu.jager.promo_backend.entity.*;
import hu.jager.promo_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GameService {

    private final GameLogRepository gameLogRepo;
    private final PrizePocketRepository prizePocketRepo;
    private final InventoryItemRepository inventoryRepo;
    private final UserRepository userRepo;
    private final GameRepository gameRepo;

    // Rögzíti, ha a játékos nyert vagy vesztett egy körben
    @Transactional
    public void recordPlayLog(Long userId, Long gameId, boolean isWinner) {
        AppUser user = userRepo.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Felhasználó nem található!"));

        Game game = gameRepo.findById(gameId)
                .orElseThrow(() -> new IllegalArgumentException("Játék nem található!"));

        GameLog log = new GameLog();
        log.setUser(user);
        log.setGameName(game.getName());
        log.setWinner(isWinner);

        gameLogRepo.save(log);
    }

    // Amikor a Busz játék végén a játékos rábök egy nyereményre
    @Transactional
    public PrizePocket claimPrize(Long userId, Long inventoryItemId) {
        // 1. Megnézzük, van-e még "üres zsebe" (A max 2 beváltás szabálya)
        long currentPrizes = prizePocketRepo.countByUserId(userId);
        if (currentPrizes >= 2) {
            throw new IllegalStateException("Már elérted a maximális 2 nyereményt a mai napra!");
        }

        // 2. Zároljuk és ellenőrizzük a készletet (hogy ketten ne vigyék el az utolsó sapkát)
        InventoryItem item = inventoryRepo.findById(inventoryItemId).orElseThrow();
        if (item.getRemainingQuantity() <= 0) {
            throw new IllegalStateException("Hoppá, erről pont lecsúsztál! Kérlek, válassz mást!");
        }

        // 3. Levonjuk a készletből
        item.setRemainingQuantity(item.getRemainingQuantity() - 1);
        inventoryRepo.save(item);

        // 4. Létrehozzuk a nyereményt a zsebben egy egyedi QR kóddal
        AppUser user = userRepo.findById(userId).orElseThrow();
        PrizePocket pocket = new PrizePocket();
        pocket.setUser(user);
        pocket.setInventoryItem(item);
        pocket.setQrCodeHash(UUID.randomUUID().toString()); // Generálunk egy titkos, egyedi azonosítót

        return prizePocketRepo.save(pocket);
    }
}
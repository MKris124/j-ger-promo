package hu.jager.promo_backend.repository;

import hu.jager.promo_backend.entity.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {

    // Visszaadja azokat a nyereményeket, amikből MÁR NINCS (remaining_quantity = 0)
    List<InventoryItem> findByRemainingQuantityEquals(Integer quantity);

    // Visszaadja azokat, amikből MÉG VAN (remaining_quantity > 0)
    List<InventoryItem> findByRemainingQuantityGreaterThan(Integer quantity);

    // Csak azt ellenőrzi, van-e még bármiből — nem tölti be a teljes listát
    boolean existsByRemainingQuantityGreaterThan(Integer quantity);

    // Archivált (soft-deletelt) itemek kizárva — ezek nem "élő" nyeremények többé,
    // de a remaining_quantity mezőjük megmaradhat, ami félrevezetné a kifogyás-ellenőrzést
    List<InventoryItem> findByRemainingQuantityGreaterThanAndArchivedFalse(Integer quantity);

    boolean existsByRemainingQuantityGreaterThanAndArchivedFalse(Integer quantity);
}

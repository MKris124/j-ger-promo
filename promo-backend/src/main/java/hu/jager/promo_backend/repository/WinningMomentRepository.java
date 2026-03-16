package hu.jager.promo_backend.repository;

import hu.jager.promo_backend.entity.WinningMoment;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface WinningMomentRepository extends JpaRepository<WinningMoment, Long> {

    // Legrégebbi lejárt, még ki nem adott nyerő pillanat
    @Query("SELECT w FROM WinningMoment w WHERE w.scheduledAt <= :now AND w.claimed = false " +
            "AND w.inventoryItem.remainingQuantity > 0 ORDER BY w.scheduledAt ASC")
    List<WinningMoment> findUnclaimedMoments(@Param("now") LocalDateTime now, Pageable pageable);

    default Optional<WinningMoment> findNextUnclaimedMoment(LocalDateTime now) {
        List<WinningMoment> results = findUnclaimedMoments(now,
                org.springframework.data.domain.PageRequest.of(0, 1));
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    // Összes ki nem adott pillanat törlése (újrageneráláshoz)
    void deleteAllByClaimedFalse();

    // Hány nyerő pillanat van még
    long countByClaimedFalse();
}
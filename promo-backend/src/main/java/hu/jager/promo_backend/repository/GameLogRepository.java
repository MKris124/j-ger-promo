package hu.jager.promo_backend.repository;

import hu.jager.promo_backend.entity.GameLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GameLogRepository extends JpaRepository<GameLog, Long> {

    // Lekéri egy user eddigi összes játékát
    List<GameLog> findAllByUserId(Long userId);

    // Megszámolja, hányszor próbálkozott összesen
    long countByUserId(Long userId);

    List<GameLog> findByUserIdOrderByPlayedAtDesc(Long userId);
}
package hu.jager.promo_backend.repository;

import hu.jager.promo_backend.entity.PrizePocket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PrizePocketRepository extends JpaRepository<PrizePocket, Long> {

    List<PrizePocket> findAllByUserId(Long userId);

    Optional<PrizePocket> findByQrCodeHash(String qrCodeHash);

    long countByUserId(Long userId);

    // Csak AVAILABLE zsebeket számol — a 2 nyeremény limit ellenőrzéséhez
    long countByUserIdAndStatus(Long userId, PrizePocket.Status status);

    // Csak AVAILABLE zsebek törlése (esemény be/ki kapcsoláskor)
    @Modifying
    @Query("DELETE FROM PrizePocket p WHERE p.status = 'AVAILABLE'")
    int deleteAllNotRedeemed();

    // MINDEN zseb törlése — játékváltáskor (beváltottak sem kellenek)
    @Modifying
    @Query("DELETE FROM PrizePocket p")
    void deleteAllPockets();
}
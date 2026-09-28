package hu.jager.promo_backend.repository;

import hu.jager.promo_backend.entity.PrizePocket;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PrizePocketRepository extends JpaRepository<PrizePocket, Long> {

    List<PrizePocket> findAllByUserId(Long userId);

    Optional<PrizePocket> findByQrCodeHash(String qrCodeHash);

    // Beváltáskor: sorzár, hogy két egyidejű beváltási kérés (pl. dupla tap, két promóter eszköz)
    // ne tudja ugyanazt a zsebet egyszerre AVAILABLE-nek látni és mindkettő végrehajtani a beváltást
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PrizePocket p WHERE p.qrCodeHash = :qrCodeHash")
    Optional<PrizePocket> findByQrCodeHashForUpdate(@Param("qrCodeHash") String qrCodeHash);

    long countByUserId(Long userId);

    // Csak AVAILABLE zsebeket számol — a 2 nyeremény limit ellenőrzéséhez
    long countByUserIdAndStatus(Long userId, PrizePocket.Status status);

    // MINDEN zseb törlése — esemény be/ki kapcsoláskor ÉS játékváltáskor is
    // (beváltottak sem kellenek, teljes reset)
    @Modifying
    @Query("DELETE FROM PrizePocket p")
    int deleteAllPockets();

    // Felhasználó törlésekor: a saját zsebei törlődnek
    @Modifying
    @Query("DELETE FROM PrizePocket p WHERE p.user.id = :userId")
    void deleteAllByUserId(@Param("userId") Long userId);

    // Felhasználó törlésekor: ha promóterként váltott be másoknak zsebeket,
    // azokat a zsebeket megtartjuk — csak a promóter referenciát oldjuk el
    @Modifying
    @Query("UPDATE PrizePocket p SET p.redeemedByPromoter = null WHERE p.redeemedByPromoter.id = :userId")
    void detachRedeemedByPromoter(@Param("userId") Long userId);
}
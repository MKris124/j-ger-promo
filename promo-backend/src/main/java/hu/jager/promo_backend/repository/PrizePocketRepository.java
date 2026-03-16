package hu.jager.promo_backend.repository;

import hu.jager.promo_backend.entity.PrizePocket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PrizePocketRepository extends JpaRepository<PrizePocket, Long> {

    // Egy adott user összes nyereménye (a Profil fülhöz)
    List<PrizePocket> findAllByUserId(Long userId);

    // A pultos QR kód olvasója ez alapján találja meg az adott nyereményt
    Optional<PrizePocket> findByQrCodeHash(String qrCodeHash);

    // Megszámolja, hány nyereménye van a usernek (hogy limitálhassuk pl. max 2-re)
    long countByUserId(Long userId);

    List<PrizePocket> findByUserId(Long userId);
}

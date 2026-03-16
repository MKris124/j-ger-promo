package hu.jager.promo_backend.repository;

import hu.jager.promo_backend.entity.Game;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GameRepository extends JpaRepository<Game, Long> {

    // Csak az aktív játékokat adja vissza (amit az admin nem kapcsolt ki)
    List<Game> findAllByIsActiveTrue();

    // Komponens neve alapján megtalálja a játékot (a frontend routing-hoz kell majd)
    Optional<Game> findByFrontendComponentName(String componentName);
}

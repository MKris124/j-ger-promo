package hu.jager.promo_backend.repository;

import hu.jager.promo_backend.entity.Game;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GameRepository extends JpaRepository<Game, Long> {

    // Csak az aktív játékokat adja vissza (amit az admin nem kapcsolt ki)
    List<Game> findAllByIsActiveTrue();
}

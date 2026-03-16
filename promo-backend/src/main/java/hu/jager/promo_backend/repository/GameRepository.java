package hu.jager.promo_backend.repository;

import hu.jager.promo_backend.entity.Game;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GameRepository extends JpaRepository<Game, Long> {

    List<Game> findAllByIsActiveTrue();

    Optional<Game> findByGameKey(String gameKey);
}
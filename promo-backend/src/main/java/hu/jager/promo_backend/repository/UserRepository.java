package hu.jager.promo_backend.repository;

import hu.jager.promo_backend.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByEmail(String email);

    // Sosem megerősített, régen lejárt kódú "szellem" regisztrációk törlése —
    // a null-os emailVerified (régi, funkció előtti userek) szándékosan NEM egyezik false-szal,
    // azokhoz nem nyúlunk
    @Modifying
    @Query("DELETE FROM AppUser u WHERE u.emailVerified = false AND u.verificationCodeExpiresAt < :cutoff")
    int deleteStaleUnverified(@Param("cutoff") LocalDateTime cutoff);
}

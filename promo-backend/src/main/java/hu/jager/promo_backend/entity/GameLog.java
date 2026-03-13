package hu.jager.promo_backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "game_logs")
@Data
@NoArgsConstructor
public class GameLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @Column(nullable = false)
    private String gameName;

    @Column(nullable = false)
    private boolean isWinner; // Nyert vagy vesztett?

    private LocalDateTime playedAt = LocalDateTime.now();
}

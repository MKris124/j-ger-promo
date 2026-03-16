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
    @JoinColumn(name = "user_id")
    private AppUser user;

    private String gameName;

    private boolean winner;

    private LocalDateTime playedAt;

    // Ha nyert, melyik nyereményt kapta — null ha veszített
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_item_id", nullable = true)
    private InventoryItem inventoryItem;
}
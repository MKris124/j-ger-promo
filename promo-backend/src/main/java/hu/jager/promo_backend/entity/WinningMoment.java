package hu.jager.promo_backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "winning_moments")
@Data
@NoArgsConstructor
public class WinningMoment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Melyik inventory itemhez tartozik ez a nyerő pillanat
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_item_id", nullable = false)
    private InventoryItem inventoryItem;

    // Mikor válik aktívvá ez a nyerő pillanat
    @Column(nullable = false)
    private LocalDateTime scheduledAt;

    // Már kiadta-e valakinek a backend
    private boolean claimed = false;

    // Ki nyerte (ha már ki lett adva)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "claimed_by_user_id")
    private AppUser claimedBy;

    private LocalDateTime claimedAt;
}
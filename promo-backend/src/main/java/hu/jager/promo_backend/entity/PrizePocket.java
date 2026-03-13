package hu.jager.promo_backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "prize_pockets")
@Data
@NoArgsConstructor
public class PrizePocket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user; // Ki nyerte?

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_item_id", nullable = false)
    private InventoryItem inventoryItem; // Mit nyert?

    @Column(unique = true, nullable = false)
    private String qrCodeHash; // Az egyedi QR kód azonosítója

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.AVAILABLE;

    private LocalDateTime wonAt = LocalDateTime.now();

    private LocalDateTime redeemedAt; // Mikor vette át?

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "redeemed_by_promoter_id")
    private AppUser redeemedByPromoter; // Melyik pultos/promóter adta ki?

    public enum Status {
        AVAILABLE, REDEEMED
    }
}

package hu.jager.promo_backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "inventory_items")
@Data
@NoArgsConstructor
public class InventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String name; // Pl. "Jäger Kemcső", "Fekete Sapka"

    @Column(nullable = false)
    private boolean isLiquid; // Ha true, a frontend literben kéri be, és a backend felszorozza

    private Integer totalQuantity = 0; // Összesen felvitt mennyiség

    private Integer remainingQuantity = 0; // Jelenleg elérhető mennyiség
}

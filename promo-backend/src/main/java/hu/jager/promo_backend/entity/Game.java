package hu.jager.promo_backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "games")
@Data
@NoArgsConstructor
public class Game {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String name; // Pl. "Jäger Busz"

    @Column(nullable = false)
    private String frontendComponentName; // Pl. "RideTheBusComponent" - az Angular ez alapján tudja, mit nyisson meg

    private String description; // Opcionális leírás a játékról

    private boolean isActive = true; // Bekapcsolva/Kikapcsolva
}

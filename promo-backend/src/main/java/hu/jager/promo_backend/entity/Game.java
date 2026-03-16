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
    private String name;

    // Frontend registry kulcs — pl. "catch-the-jager", "ride-the-bus"
    // Ezzel keresi meg a frontend a megfelelő komponenst
    @Column(unique = true, nullable = false)
    private String gameKey;

    private String description;

    private boolean isActive = true;
}
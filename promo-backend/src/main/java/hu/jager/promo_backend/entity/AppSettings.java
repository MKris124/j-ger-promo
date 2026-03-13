package hu.jager.promo_backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "app_settings")
@Data
@NoArgsConstructor
public class AppSettings {

    @Id
    private Long id = 1L; // Mindig 1-es ID-vel hivatkozunk rá

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "active_game_id")
    private Game activeGame; // Melyik az éppen futó játék a buliban?

    private Integer shotsPerLiter = 52; // Liter/Kemcső szorzó

    private boolean isEventActive = true; // Pánikgomb: mehet-e a játék?
}

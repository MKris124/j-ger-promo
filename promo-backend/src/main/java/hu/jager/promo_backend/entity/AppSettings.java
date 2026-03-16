package hu.jager.promo_backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "app_settings")
@Data
@NoArgsConstructor
public class AppSettings {

    @Id
    private Long id = 1L;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "active_game_id")
    private Game activeGame;

    private Integer shotsPerLiter = 52;

    private boolean isEventActive = false;

    // Időzített mód: ha be van állítva start+end, automatikusan kapcsol
    private LocalDateTime eventStart;
    private LocalDateTime eventEnd;

    // Manuális módban: mikor lett bekapcsolva (DrawService ebből számol ha nincs start/end)
    private LocalDateTime activatedAt;

    // Sorsolási mód: "PERCENTAGE" vagy "TIMED"
    @Column(nullable = false)
    private String drawMode = "TIMED";
}
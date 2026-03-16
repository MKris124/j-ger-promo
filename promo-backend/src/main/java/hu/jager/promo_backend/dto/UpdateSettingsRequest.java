package hu.jager.promo_backend.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class UpdateSettingsRequest {
    private boolean eventActive;
    private Integer shotsPerLiter;
    private Long activeGameId;
    private String drawMode;         // "TIMED" vagy "PERCENTAGE"
    private LocalDateTime eventStart;
    private LocalDateTime eventEnd;
}
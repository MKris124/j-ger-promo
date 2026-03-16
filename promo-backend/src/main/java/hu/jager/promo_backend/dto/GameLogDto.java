package hu.jager.promo_backend.dto;

import hu.jager.promo_backend.entity.GameLog;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class GameLogDto {

    private Long id;
    private String gameName;
    private boolean winner;
    private LocalDateTime playedAt;
    private String prizeName; // null ha veszített

    public static GameLogDto from(GameLog log) {
        GameLogDto dto = new GameLogDto();
        dto.setId(log.getId());
        dto.setGameName(log.getGameName());
        dto.setWinner(log.isWinner());
        dto.setPlayedAt(log.getPlayedAt());
        dto.setPrizeName(
                log.getInventoryItem() != null ? log.getInventoryItem().getName() : null
        );
        return dto;
    }
}
package hu.jager.promo_backend.dto;

import lombok.Data;

@Data
public class PlayGameRequest {
    private Long userId;
    private Long gameId;
    private boolean isWinner; // true ha nyert, false ha veszített
}
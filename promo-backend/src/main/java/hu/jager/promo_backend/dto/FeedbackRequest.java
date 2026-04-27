package hu.jager.promo_backend.dto;

import lombok.Data;

@Data
public class FeedbackRequest {
    private int rating;
    private String comment;
}
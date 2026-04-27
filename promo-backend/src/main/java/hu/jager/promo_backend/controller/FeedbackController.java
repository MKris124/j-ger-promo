package hu.jager.promo_backend.controller;

import hu.jager.promo_backend.dto.FeedbackRequest;
import hu.jager.promo_backend.service.FeedbackService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService feedbackService;

    @PostMapping
    public ResponseEntity<?> submitFeedback(@RequestBody FeedbackRequest request) {
        // Csak kiszedjük, hogy ki hívta a végpontot
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String email = auth.getName();

        // A piszkos munkát a Service végzi el
        feedbackService.saveFeedback(request, email);

        return ResponseEntity.ok(Map.of("message", "Köszönjük a visszajelzést!"));
    }
}
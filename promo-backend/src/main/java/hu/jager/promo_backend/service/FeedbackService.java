package hu.jager.promo_backend.service;

import hu.jager.promo_backend.dto.FeedbackRequest;
import hu.jager.promo_backend.dto.FeedbackResponse;
import hu.jager.promo_backend.entity.AppUser;
import hu.jager.promo_backend.entity.Feedback;
import hu.jager.promo_backend.repository.FeedbackRepository;
import hu.jager.promo_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;

    public void saveFeedback(FeedbackRequest request, AppUser user) {
        Feedback feedback = new Feedback();
        feedback.setRating(request.getRating());
        feedback.setComment(request.getComment());

        feedback.setUser(user);

        feedbackRepository.save(feedback);
    }

    // 2. Értékelések lekérdezése (Az admin nézi)
    public List<FeedbackResponse> getAllFeedbacksForAdmin() {
        return feedbackRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(f -> {
                    FeedbackResponse dto = new FeedbackResponse();
                    dto.setId(f.getId());
                    dto.setUserName(f.getUser().getName());
                    dto.setRating(f.getRating());
                    dto.setComment(f.getComment());
                    dto.setCreatedAt(f.getCreatedAt());
                    return dto;
                })
                .collect(Collectors.toList());
    }
}
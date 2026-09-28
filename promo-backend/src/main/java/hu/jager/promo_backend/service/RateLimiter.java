package hu.jager.promo_backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Egyszerű, memóriában tárolt fixed-window rate limiter.
 * Egyetlen backend példányra tervezve (nincs Redis / megosztott állapot) —
 * ennél az alkalmazásnál (egy backend konténer) ez elég, nem kell külső infra.
 */
@Slf4j
@Component
public class RateLimiter {

    private static class Bucket {
        final AtomicInteger count = new AtomicInteger(0);
        volatile long windowStart = System.currentTimeMillis();
    }

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    /** @return true, ha az akció még engedélyezett a limiten belül; false, ha a kulcs kimerítette a keretet */
    public boolean tryAcquire(String key, int maxAttempts, Duration window) {
        Bucket bucket = buckets.computeIfAbsent(key, k -> new Bucket());
        long now = System.currentTimeMillis();

        synchronized (bucket) {
            if (now - bucket.windowStart > window.toMillis()) {
                bucket.windowStart = now;
                bucket.count.set(0);
            }
            return bucket.count.incrementAndGet() <= maxAttempts;
        }
    }

    // Óránként takarítjuk a régen inaktív bucketeket, hogy ne nőjön végtelenül a memória
    @Scheduled(cron = "0 30 * * * *")
    public void cleanup() {
        long now = System.currentTimeMillis();
        int before = buckets.size();
        buckets.entrySet().removeIf(e -> now - e.getValue().windowStart > Duration.ofHours(2).toMillis());
        int removed = before - buckets.size();
        if (removed > 0) {
            log.debug("RateLimiter cleanup: {} elavult bucket törölve", removed);
        }
    }
}

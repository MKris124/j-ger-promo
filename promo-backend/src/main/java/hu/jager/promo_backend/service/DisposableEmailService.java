package hu.jager.promo_backend.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

@Slf4j
@Service
public class DisposableEmailService {

    // classpath:disposable-email-domains.txt — egy domain / sor, '#' = komment.
    // Bővíthető listahoz csak a txt fájlt kell szerkeszteni, kód nem változik.
    private final Set<String> blockedDomains = new HashSet<>();

    @PostConstruct
    private void loadBlocklist() {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new ClassPathResource("disposable-email-domains.txt").getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String domain = line.trim().toLowerCase();
                if (!domain.isEmpty() && !domain.startsWith("#")) {
                    blockedDomains.add(domain);
                }
            }
            log.info("Eldobható e-mail domain lista betöltve: {} domain", blockedDomains.size());
        } catch (Exception e) {
            log.error("Nem sikerült betölteni az eldobható e-mail domain listát — a szűrés kikapcsolva marad", e);
        }
    }

    public boolean isDisposable(String email) {
        if (email == null || !email.contains("@")) {
            return false;
        }
        String domain = email.substring(email.lastIndexOf('@') + 1).trim().toLowerCase();
        return blockedDomains.contains(domain);
    }
}

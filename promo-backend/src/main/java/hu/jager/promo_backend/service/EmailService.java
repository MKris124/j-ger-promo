package hu.jager.promo_backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    // ObjectProvider: ha nincs spring.mail.host beállítva (pl. dev), nem lesz JavaMailSender bean —
    // ez a becsomagolás elkerüli az induláskori hibát, és lehetővé teszi a lenti fallback logolást.
    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${app.mail.from:no-reply@jager-sbm-game.hu}")
    private String fromAddress;

    public void sendVerificationCode(String toEmail, String name, String code) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();

        if (mailSender == null) {
            // Nincs SMTP konfigurálva — fejlesztéskor a kód a logban jelenik meg
            log.warn("SMTP nincs konfigurálva! Megerősítő kód ehhez: {} -> {}", toEmail, code);
            return;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(toEmail);
        message.setSubject("Jägermeister SBM Game — Erősítsd meg a regisztrációdat");
        message.setText("""
                Szia %s!

                A megerősítő kódod: %s

                A kód 15 percig érvényes.

                Jägermeister SBM Game csapat
                """.formatted(name, code));

        try {
            mailSender.send(message);
        } catch (MailException e) {
            // A MailParseException egyargumentumos konstruktora mindig "Could not parse mail"-t ad vissza —
            // a valódi ok a cause láncban van, azt is kilogoljuk (from-ot is, hogy látszódjon pl. ha idézőjeles)
            log.error("Nem sikerült elküldeni a megerősítő e-mailt: to={} from='{}' — {}",
                    toEmail, fromAddress, e.getMessage(), e);
            throw new IllegalArgumentException("Nem sikerült elküldeni a megerősítő e-mailt. Kérlek, próbáld meg később!");
        }
    }
}

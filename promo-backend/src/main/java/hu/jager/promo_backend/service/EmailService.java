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
        send(toEmail, code,
                "Jägermeister SBM Game — Erősítsd meg a regisztrációdat",
                """
                Szia %s!

                A megerősítő kódod: %s

                A kód 15 percig érvényes.

                Jägermeister SBM Game csapat
                """.formatted(name, code));
    }

    public void sendPasswordResetCode(String toEmail, String name, String code) {
        send(toEmail, code,
                "Jägermeister SBM Game — Jelszó visszaállítása",
                """
                Szia %s!

                Valaki (remélhetőleg te) jelszó-visszaállítást kért a fiókodhoz.
                A kódod: %s

                A kód 15 percig érvényes. Ha nem te kérted, nyugodtan hagyd figyelmen kívül ezt az e-mailt.

                Jägermeister SBM Game csapat
                """.formatted(name, code));
    }

    private void send(String toEmail, String code, String subject, String body) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();

        if (mailSender == null) {
            // Nincs SMTP konfigurálva — fejlesztéskor a kód a logban jelenik meg
            log.warn("SMTP nincs konfigurálva! Kód ehhez: {} -> {}", toEmail, code);
            return;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(toEmail);
        message.setSubject(subject);
        message.setText(body);

        try {
            mailSender.send(message);
        } catch (MailException e) {
            // A MailParseException egyargumentumos konstruktora mindig "Could not parse mail"-t ad vissza —
            // a valódi ok a cause láncban van, azt is kilogoljuk (from-ot is, hogy látszódjon pl. ha idézőjeles)
            log.error("Nem sikerült elküldeni az e-mailt: to={} from='{}' — {}",
                    toEmail, fromAddress, e.getMessage(), e);
            throw new IllegalArgumentException("Nem sikerült elküldeni az e-mailt. Kérlek, próbáld meg később!");
        }
    }
}

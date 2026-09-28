package hu.jager.promo_backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.naming.NamingException;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Hashtable;

@Slf4j
@Service
public class EmailDomainValidator {

    // Létezik-e az e-mail domainje, és tud-e egyáltalán levelet fogadni (van-e MX, vagy legalább A/AAAA rekordja)?
    // Ez kiszűri a nyilvánvalóan kitalált domaineket (pl. "hsjs.hsjs"), ahol nincs értelme
    // egy teljes SMTP kísérletet indítani, mielőtt a felhasználó egyáltalán elküldte az űrlapot.
    public boolean hasValidMailDomain(String email) {
        if (email == null || !email.contains("@")) {
            return false;
        }
        String domain = email.substring(email.lastIndexOf('@') + 1).trim();
        if (domain.isEmpty()) {
            return false;
        }

        try {
            if (hasMxRecord(domain)) {
                return true;
            }
            // Nincs MX — próbáljunk A/AAAA rekordot (RFC 5321 szerinti implicit MX fallback)
            InetAddress.getByName(domain);
            return true;
        } catch (NamingException | UnknownHostException e) {
            log.warn("Nincs érvényes mail-domain: {} ({})", domain, e.getMessage());
            return false;
        } catch (Exception e) {
            // Váratlan hiba (pl. DNS timeout) — ilyenkor NE zárjunk ki valakit egy átmeneti
            // DNS probléma miatt, inkább engedjük át (fail-open)
            log.error("DNS ellenőrzés hiba domainre: {} — átengedve (fail-open)", domain, e);
            return true;
        }
    }

    private boolean hasMxRecord(String domain) throws NamingException {
        Hashtable<String, String> env = new Hashtable<>();
        env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
        env.put("com.sun.jndi.dns.timeout.initial", "3000");
        env.put("com.sun.jndi.dns.timeout.retries", "1");

        DirContext ctx = new InitialDirContext(env);
        try {
            Attributes attrs = ctx.getAttributes(domain, new String[]{"MX"});
            Attribute mx = attrs.get("MX");
            return mx != null && mx.size() > 0;
        } finally {
            ctx.close();
        }
    }
}

package hu.jager.promo_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class PromoBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(PromoBackendApplication.class, args);
	}

}

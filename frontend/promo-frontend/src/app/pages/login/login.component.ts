import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { SocialAuthService, GoogleSigninButtonModule } from '@abacritt/angularx-social-login';
import { environment } from '../../../environments/environments';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, GoogleSigninButtonModule, RouterModule],
  templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private socialAuthService = inject(SocialAuthService);
  private http = inject(HttpClient);
  private router = inject(Router);

  // Alap állapotok
  isLoginMode = true;
  name = '';
  email = '';
  password = '';
  passwordConfirm = '';
  showPassword = false;
  showPasswordConfirm = false;
  errorMessage = '';
  isLoading = false;

  // Esemény státusz
  eventActive = false;
  eventLoading = true;

  // Age Gate (18+)
  showAgeGate = false;

  // Titkos Személyzeti Belépés (Secret Tap)
  isStaffOverride = false;
  secretClickCount = 0;

  ngOnInit() {
    if (localStorage.getItem('token')) {
      // Megnézzük, elmentettük-e korábban, hogy hol járt. Ha nem, a /game az alapértelmezett.
      const lastRoute = localStorage.getItem('lastVisitedRoute') || '/game';
      this.router.navigate([lastRoute]);
      return; // Megállítjuk a Login oldal további betöltését!
    }
    // 1. Age Gate ellenőrzés betöltéskor
    if (!sessionStorage.getItem('ageVerified')) {
      this.showAgeGate = true;
    }

    // 2. Esemény státusz lekérése a backendről
    this.http.get<{ eventActive: boolean }>(`${environment.apiUrl}/api/auth/event-status`).subscribe({
      next: (res) => {
        this.eventActive = res.eventActive;
        this.eventLoading = false;
      },
      error: () => {
        this.eventActive = true;
        this.eventLoading = false;
      }
    });

    // 3. Google Social Auth figyelése
    this.socialAuthService.authState.subscribe((user) => {
      // Ne engedjük a Google automatikus belépést, amíg a korhatár panel kint van
      if (this.showAgeGate) return;

      if (user && user.idToken) {
        // Ha le van lőve az esemény ÉS nincs titkos override, blokkoljuk a Google-t is
        if (!this.eventActive && !this.isStaffOverride) {
          this.errorMessage = 'Az esemény jelenleg szünetel. Hamarosan visszatérünk!';
          return;
        }
        this.isLoading = true;
        this.errorMessage = '';
        this.authService.loginWithGoogle(user.idToken).subscribe({
          next: (res) => {
            this.isLoading = false;
            if (res.name) localStorage.setItem('userName', res.name);
          },
          error: (err) => {
            this.isLoading = false;
            this.errorMessage = err.error || 'Hiba a Google belépés során!';
          }
        });
      }
    });
  }

  // --- AGE GATE LOGIKA ---
  verifyAge(isAdult: boolean): void {
    if (isAdult) {
      sessionStorage.setItem('ageVerified', 'true');
      this.showAgeGate = false;
    } else {
      // Ha nem elmúlt 18, irány a hivatalos Jäger oldal
      window.location.href = 'https://www.jagermeister.com';
    }
  }

  // --- TITKOS KATTINTÁS (EASTER EGG) LOGIKA ---
  onSecretClick() {
    this.secretClickCount++;
    if (this.secretClickCount >= 5) {
      this.enableStaffOverride();
      this.secretClickCount = 0;
    }
  }

  enableStaffOverride() {
    this.isStaffOverride = true;
    this.isLoginMode = true; // Fixen belépés módba váltunk
    this.errorMessage = '';
  }

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    this.errorMessage = '';
    this.password = '';
    this.passwordConfirm = '';
  }

  togglePasswordVisibility(field: 'password' | 'confirm') {
    if (field === 'password') this.showPassword = !this.showPassword;
    else this.showPasswordConfirm = !this.showPasswordConfirm;
  }

  onSubmit() {
    this.errorMessage = '';

    // Belépés blokkolása, ha nem aktív az esemény ÉS nincs titkos override
    if (!this.eventActive && !this.isStaffOverride) {
      this.errorMessage = 'Az esemény jelenleg szünetel. Hamarosan visszatérünk!';
      return;
    }

    if (!this.email || !this.password) {
      this.errorMessage = 'Kérlek tölts ki minden kötelező mezőt!';
      return;
    }

    if (!this.isLoginMode) {
      if (!this.name) {
        this.errorMessage = 'Kérlek add meg a nevedet!';
        return;
      }
      if (this.password !== this.passwordConfirm) {
        this.errorMessage = 'A két jelszó nem egyezik!';
        return;
      }
      if (this.password.length < 6) {
        this.errorMessage = 'A jelszónak legalább 6 karakternek kell lennie!';
        return;
      }
    }

    this.isLoading = true;
    const payload = this.isLoginMode
      ? { email: this.email, password: this.password }
      : { email: this.email, password: this.password, name: this.name };

    const request = this.isLoginMode
      ? this.authService.login(payload)
      : this.authService.register(payload);

    request.subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.name) localStorage.setItem('userName', res.name);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error || 'Váratlan hiba történt. Próbáld újra!';
      }
    });
  }
}
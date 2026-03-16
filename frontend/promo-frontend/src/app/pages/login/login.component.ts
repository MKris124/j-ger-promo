import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { SocialAuthService, GoogleSigninButtonModule } from '@abacritt/angularx-social-login';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, GoogleSigninButtonModule],
  templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private socialAuthService = inject(SocialAuthService);
  private http = inject(HttpClient);

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
  eventActive = true;      // optimista default — betöltés után frissül
  eventLoading = true;     // amíg töltjük, ne villogjon a "szünetel" üzenet

  ngOnInit() {
    // Esemény státusz lekérése — publikus endpoint kell hozzá a backenden
    this.http.get<{ eventActive: boolean }>('http://localhost:8080/api/auth/event-status').subscribe({
      next: (res) => {
        this.eventActive = res.eventActive;
        this.eventLoading = false;
      },
      error: () => {
        // Ha nem elérhető az endpoint, optimistán engedjük be
        this.eventActive = true;
        this.eventLoading = false;
      }
    });

    this.socialAuthService.authState.subscribe((user) => {
      if (user && user.idToken) {
        if (!this.eventActive) {
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

    if (!this.eventActive) {
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
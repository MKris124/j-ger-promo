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

  // E-mail megerősítés állapotok (regisztráció után)
  isVerifying = false;
  pendingEmail = '';
  verificationCode = '';
  infoMessage = '';
  isLoading = false;

  // Elfelejtett jelszó állapotok
  isForgotPassword = false;
  forgotPasswordStep: 'request' | 'reset' = 'request';
  resetEmail = '';
  resetCode = '';
  newPassword = '';
  newPasswordConfirm = '';
  showNewPassword = false;

  eventActive = false; // Visszaállítva a te változódra!
  eventLoading = true;

  // Age Gate (18+)
  showAgeGate = false;

  isStaffOverride = false;
  secretClickCount = 0;

  ngOnInit() {
    this.http.get<{ eventActive: boolean }>(`${environment.apiUrl}/api/auth/event-status`).subscribe({
      next: (res) => {
        this.eventActive = res.eventActive;
        this.eventLoading = false;
        this.processAutoLogin();
      },
      error: () => {
        this.eventActive = false;
        this.eventLoading = false;
        this.processAutoLogin();
      }
    });

    this.socialAuthService.authState.subscribe((user) => {
      if (this.showAgeGate) return;

      if (user && user.idToken) {
        if (!this.eventActive && !this.isStaffOverride) {
          this.errorMessage = 'Az esemény jelenleg szünetel. Hamarosan visszatérünk!';
          this.socialAuthService.signOut().catch(() => {});
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

  private processAutoLogin() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (token) {
      if (role === 'ADMIN' || role === 'PROMOTER') {
        this.handleRedirect(role);
        return;
      }

      if (!this.eventLoading) {
        if (!this.eventActive) {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          localStorage.removeItem('userName');
          localStorage.removeItem('userId');
          localStorage.removeItem('lastVisitedRoute');
          return; 
        } else {
          this.handleRedirect(role);
        }
      }
    } else {
      if (!sessionStorage.getItem('ageVerified') && this.eventActive) {
        this.showAgeGate = true;
      }
    }
  }

  private handleRedirect(role: string | null) {
    const lastRoute = localStorage.getItem('lastVisitedRoute');
    if (lastRoute && lastRoute !== '/' && lastRoute !== '/login') {
      this.router.navigateByUrl(lastRoute).catch(() => {
        this.redirectToDefault(role);
      });
    } else {
      this.redirectToDefault(role);
    }
  }

  private redirectToDefault(role: string | null) {
    if (role === 'ADMIN' || role === 'PROMOTER') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/game']);
    }
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

  onSecretClick() {
    this.secretClickCount++;
    if (this.secretClickCount >= 5) {
      this.enableStaffOverride();
      this.secretClickCount = 0;
    }
  }

  enableStaffOverride() {
    this.isStaffOverride = true;
    this.isLoginMode = true;
    this.errorMessage = '';
    this.showAgeGate = false; 
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

    if (this.isLoginMode) {
      this.authService.login({ email: this.email, password: this.password }).subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.name) localStorage.setItem('userName', res.name);
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error || 'Váratlan hiba történt. Próbáld újra!';
        }
      });
      return;
    }

    this.authService.register({ email: this.email, password: this.password, name: this.name }).subscribe({
      next: () => {
        this.isLoading = false;
        this.pendingEmail = this.email;
        this.verificationCode = '';
        this.isVerifying = true;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error || 'Váratlan hiba történt. Próbáld újra!';
      }
    });
  }

  onVerifySubmit() {
    this.errorMessage = '';
    this.infoMessage = '';

    if (!this.verificationCode) {
      this.errorMessage = 'Add meg a kapott kódot!';
      return;
    }

    this.isLoading = true;
    this.authService.verifyEmail({ email: this.pendingEmail, code: this.verificationCode }).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.name) localStorage.setItem('userName', res.name);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error || 'Hibás vagy lejárt kód!';
      }
    });
  }

  onResendCode() {
    this.errorMessage = '';
    this.infoMessage = '';
    this.authService.resendCode(this.pendingEmail).subscribe({
      next: () => {
        this.infoMessage = 'Új kódot küldtünk az e-mail címedre!';
      },
      error: (err) => {
        this.errorMessage = err.error || 'Nem sikerült új kódot küldeni!';
      }
    });
  }

  cancelVerification() {
    this.isVerifying = false;
    this.verificationCode = '';
    this.errorMessage = '';
    this.infoMessage = '';
  }

  openForgotPassword(): void {
    this.isForgotPassword = true;
    this.forgotPasswordStep = 'request';
    this.resetEmail = this.email;
    this.resetCode = '';
    this.newPassword = '';
    this.newPasswordConfirm = '';
    this.errorMessage = '';
    this.infoMessage = '';
  }

  cancelForgotPassword(): void {
    this.isForgotPassword = false;
    this.resetCode = '';
    this.newPassword = '';
    this.newPasswordConfirm = '';
    this.errorMessage = '';
    this.infoMessage = '';
  }

  onForgotPasswordSubmit(): void {
    this.errorMessage = '';
    this.infoMessage = '';

    if (!this.resetEmail) {
      this.errorMessage = 'Add meg az e-mail címed!';
      return;
    }

    this.isLoading = true;
    this.authService.forgotPassword(this.resetEmail).subscribe({
      next: () => {
        this.isLoading = false;
        this.forgotPasswordStep = 'reset';
        this.infoMessage = 'Elküldtük a kódot az e-mail címedre!';
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error || 'Váratlan hiba történt. Próbáld újra!';
      }
    });
  }

  onResendResetCode(): void {
    this.errorMessage = '';
    this.infoMessage = '';
    this.authService.forgotPassword(this.resetEmail).subscribe({
      next: () => {
        this.infoMessage = 'Új kódot küldtünk az e-mail címedre!';
      },
      error: (err) => {
        this.errorMessage = err.error || 'Nem sikerült új kódot küldeni!';
      }
    });
  }

  onResetPasswordSubmit(): void {
    this.errorMessage = '';
    this.infoMessage = '';

    if (!this.resetCode || !this.newPassword) {
      this.errorMessage = 'Töltsd ki az összes mezőt!';
      return;
    }
    if (this.newPassword !== this.newPasswordConfirm) {
      this.errorMessage = 'A két jelszó nem egyezik!';
      return;
    }
    if (this.newPassword.length < 6) {
      this.errorMessage = 'A jelszónak legalább 6 karakternek kell lennie!';
      return;
    }

    this.isLoading = true;
    this.authService.resetPassword({ email: this.resetEmail, code: this.resetCode, newPassword: this.newPassword }).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.name) localStorage.setItem('userName', res.name);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error || 'Hibás vagy lejárt kód!';
      }
    });
  }
}
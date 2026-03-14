import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SocialAuthService, GoogleSigninButtonModule } from '@abacritt/angularx-social-login';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, GoogleSigninButtonModule],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private socialAuthService = inject(SocialAuthService);

  isLoginMode = true;
  name = '';
  email = '';
  password = '';
  passwordConfirm = '';
  showPassword = false;
  showPasswordConfirm = false;
  errorMessage = '';
  isLoading = false;

  ngOnInit() {
    // Ez figyel arra, ha a Google ablak sikeresen bezárul
    this.socialAuthService.authState.subscribe((user) => {
      if (user && user.idToken) {
        this.isLoading = true;
        this.errorMessage = '';
        
        // Elküldjük a tokent a mi saját Spring Boot backendünknek!
        this.authService.loginWithGoogle(user.idToken).subscribe({
          next: (res) => {
            this.isLoading = false;
            if(res.name) localStorage.setItem('userName', res.name);
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
    // Váltáskor ürítsük ki a jelszavakat biztonsági okokból
    this.password = '';
    this.passwordConfirm = '';
  }

  togglePasswordVisibility(field: 'password' | 'confirm') {
    if (field === 'password') this.showPassword = !this.showPassword;
    else this.showPasswordConfirm = !this.showPasswordConfirm;
  }

  onSubmit() {
    this.errorMessage = '';
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
        if(res.name) localStorage.setItem('userName', res.name);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error || 'Váratlan hiba történt. Próbáld újra!';
      }
    });
  }
}
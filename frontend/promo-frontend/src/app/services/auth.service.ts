import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = 'http://localhost:8080/api/auth';

  // Belépés
  login(credentials: any) {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => this.saveSession(response))
    );
  }

  // Regisztráció
  register(credentials: any) {
    return this.http.post<any>(`${this.apiUrl}/register`, credentials).pipe(
      tap(response => this.saveSession(response))
    );
  }

  // Sikeres belépés/regisztráció után elmentjük a tokent és átirányítjuk a játékba
  private saveSession(response: any) {
    localStorage.setItem('token', response.token);
    localStorage.setItem('role', response.role);
    this.router.navigate(['/game']);
  }

  // Kijelentkezés
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    this.router.navigate(['/']);
  }


  loginWithGoogle(token: string) {
    return this.http.post<any>(`${this.apiUrl}/google`, { token }).pipe(
      tap(response => this.saveSession(response))
    );
  }
}
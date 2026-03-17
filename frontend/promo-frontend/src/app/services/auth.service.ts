import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = `${environment.apiUrl}/api/auth`;

  login(credentials: any) {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => this.saveSession(response))
    );
  }

  register(credentials: any) {
    return this.http.post<any>(`${this.apiUrl}/register`, credentials).pipe(
      tap(response => this.saveSession(response))
    );
  }

  loginWithGoogle(token: string) {
    return this.http.post<any>(`${this.apiUrl}/google`, { token }).pipe(
      tap(response => this.saveSession(response))
    );
  }

  private saveSession(response: any) {
    localStorage.setItem('token', response.token);
    localStorage.setItem('role', response.role);
    if (response.name) localStorage.setItem('userName', response.name);
    if (response.id)   localStorage.setItem('userId', response.id.toString());

    // Role alapján irányítjuk a megfelelő oldalra
    switch (response.role) {
      case 'ADMIN':    this.router.navigate(['/admin']);    break;
      case 'PROMOTER': this.router.navigate(['/promoter']); break;
      default:         this.router.navigate(['/game']);     break;
    }
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    this.router.navigate(['/']);
  }

  getToken(): string {
    return localStorage.getItem('token') || '';
  }

  getRole(): string {
    return localStorage.getItem('role') || '';
  }

  getUserId(): number {
    return parseInt(localStorage.getItem('userId') || '0', 10);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }
}
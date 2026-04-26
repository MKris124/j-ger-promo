import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, BehaviorSubject } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { environment } from '../../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private apiUrl = `${environment.apiUrl}/api/auth`;

  // Reaktív állapot a menü/egyéb komponensek gyors frissítéséhez
  private loggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isLoggedIn$ = this.loggedInSubject.asObservable();

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

    // Beállítjuk a reaktív állapotot "belépett"-re
    this.loggedInSubject.next(true);

    // Kinyerjük a Guard által átadott URL-t (ha volt)
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || this.getReturnUrlFromWindow();

    if (returnUrl) {
      // Ha tudjuk hova akart menni (pl. F5 után megszakadt a session, vagy megosztottak neki egy linket), oda rakjuk!
      this.router.navigateByUrl(returnUrl);
    } else {
      // Ha simán magától lépett be a főoldalról, akkor a role alapján irányítjuk
      switch (response.role) {
        case 'ADMIN':    this.router.navigate(['/admin']);    break;
        case 'PROMOTER': this.router.navigate(['/promoter']); break;
        default:         this.router.navigate(['/game']);     break;
      }
    }
  }

  // Fallback metódus, ha a login oldalon közvetlenül landol a router frissítés előtt
  private getReturnUrlFromWindow(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('returnUrl');
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    
    this.loggedInSubject.next(false);
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
    return this.hasToken();
  }

  private hasToken(): boolean {
    return !!localStorage.getItem('token');
  }
}
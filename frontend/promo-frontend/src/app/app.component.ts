import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as PullToRefresh from 'pulltorefreshjs';
import { filter } from 'rxjs/operators';
import { environment } from '../environments/environments';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private http = inject(HttpClient);

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects;
      if (url !== '/' && !url.includes('/login') && !url.includes('/privacy')) {
        localStorage.setItem('lastVisitedRoute', url);
      }

      const token = localStorage.getItem('token');
      if (token) {
        this.http.get<{token: string, role: string, name: string}>(`${environment.apiUrl}/api/auth/refresh`)
          .subscribe({
            next: (res) => {
              const oldRole = localStorage.getItem('role');
              
              localStorage.setItem('token', res.token);
              localStorage.setItem('role', res.role);
              if (res.name) localStorage.setItem('userName', res.name);

              if (oldRole && oldRole !== res.role) {
                console.warn(`Rangfrissítés történt: ${oldRole} -> ${res.role}. Újratöltés...`);
                window.location.reload(); 
              }
            },
            error: () => {
            }
          });
      }
    });
  }
  
  ngOnInit() {
  
    PullToRefresh.init({
      mainElement: 'body',
      instructionsPullToRefresh: '',
      instructionsReleaseToRefresh: '',
      instructionsRefreshing: '',
      onRefresh() {
        window.location.reload();
      }
    });
  }

  ngOnDestroy() {
    // Memóriaszivárgás megelőzése
    PullToRefresh.destroyAll();
  }
}
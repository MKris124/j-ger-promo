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
      
      if (url === '/' || url.includes('/login') || url.includes('/privacy')) {
        return; 
      }

      const token = localStorage.getItem('token');
      if (token) {
        this.http.get<any>(`${environment.apiUrl}/api/auth/refresh`)
          .subscribe({
            next: (res) => {
              const oldRole = localStorage.getItem('role');
              
              localStorage.setItem('token', res.token);
              localStorage.setItem('role', res.role); 
              if (res.name) localStorage.setItem('userName', res.name);
              if (res.id) localStorage.setItem('userId', res.id.toString());

              if (oldRole && oldRole !== res.role) {
                console.warn(`Rangfrissítés: ${oldRole} -> ${res.role}.`);
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
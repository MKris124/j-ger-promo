import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router, NavigationEnd } from '@angular/router';
import * as PullToRefresh from 'pulltorefreshjs';
import { filter } from 'rxjs/operators';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  private router = inject(Router);

  constructor() {
    // Minden sikeres oldalváltáskor elmentjük a böngészőbe a címet
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects;
      if (url !== '/' && !url.includes('/login') && !url.includes('/privacy')) {
        localStorage.setItem('lastVisitedRoute', url);
      }
    });
  }
  
  ngOnInit() {
    // 2. Inicializáljuk a "lehúzós" frissítőt
    PullToRefresh.init({
      mainElement: 'body', // Melyik elem húzható le
      instructionsPullToRefresh: '',
      instructionsReleaseToRefresh: '',
      instructionsRefreshing: '',
      // Ha lefutott a húzás, egyszerűen újratöltjük a böngészőablakot
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
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
      // Nem akarjuk elmenteni a login oldalt "utolsóként látogatottnak"
      if (!event.urlAfterRedirects.includes('/login')) {
        localStorage.setItem('lastVisitedRoute', event.urlAfterRedirects);
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
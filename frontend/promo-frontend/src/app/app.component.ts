import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import * as PullToRefresh from 'pulltorefreshjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  
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
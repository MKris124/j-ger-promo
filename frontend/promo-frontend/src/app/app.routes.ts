import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { GameComponent } from './pages/game/game.component';
import { AdminComponent } from './pages/admin/admin.component';
import { PromoterComponent } from './pages/promoter/promoter.component';

export const routes: Routes = [
  { path: '', component: LoginComponent }, // Ez lesz a kezdőlap
  { path: 'game', component: GameComponent },
  { path: 'admin', component: AdminComponent },
  { path: 'promoter', component: PromoterComponent },
  { path: '**', redirectTo: '' } // Ha hülyeséget ír az URL-be, visszadobja a loginra
];
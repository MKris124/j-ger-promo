import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { GameComponent } from './pages/game/game.component';
import { AdminComponent } from './pages/admin/admin.component';
import { PromoterComponent } from './pages/promoter/promoter.component';
import { adminGuard } from './pages/admin/admin.guard';
import { promoterGuard } from './pages/promoter/promoter.guard';


export const routes: Routes = [
  { path: '', component: LoginComponent }, // Ez lesz a kezdőlap
  { path: 'game', component: GameComponent },
  { path: 'admin', component: AdminComponent, canActivate: [adminGuard] },
  { path: 'promoter', component: PromoterComponent , canActivate: [promoterGuard]},
  { path: '**', redirectTo: '' } // Ha hülyeséget ír az URL-be, visszadobja a loginra
];
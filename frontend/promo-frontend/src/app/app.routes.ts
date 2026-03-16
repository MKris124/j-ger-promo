import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { GameComponent } from './pages/game/game.component';
import { AdminComponent } from './pages/admin/admin.component';
import { PromoterComponent } from './pages/promoter/promoter.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { adminGuard } from './pages/admin/admin.guard';
import { promoterGuard } from './pages/promoter/promoter.guard';
import { gameGuard } from './pages/game/game.guard';

import { PrivacyComponent } from './pages/privacy/privacy.component';

export const routes: Routes = [
  { path: '',        component: LoginComponent },
  { path: 'game',    component: GameComponent,    canActivate: [gameGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [gameGuard] },
  { path: 'admin',   component: AdminComponent,   canActivate: [adminGuard] },
  { path: 'promoter',component: PromoterComponent,canActivate: [promoterGuard] },
  { path: 'privacy', component: PrivacyComponent },
  { path: '**', redirectTo: '' }
];
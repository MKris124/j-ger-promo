import { Routes } from '@angular/router';
import { adminGuard } from './pages/admin/admin.guard';
import { promoterGuard } from './pages/promoter/promoter.guard';
import { gameGuard } from './pages/game/game.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'game', loadComponent: () => import('./pages/game/game.component').then(m => m.GameComponent), canActivate: [gameGuard] },
  { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent), canActivate: [gameGuard] },
  { path: 'admin', loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent), canActivate: [adminGuard] },
  { path: 'promoter', loadComponent: () => import('./pages/promoter/promoter.component').then(m => m.PromoterComponent), canActivate: [promoterGuard] },
  { path: 'privacy', loadComponent: () => import('./pages/privacy/privacy.component').then(m => m.PrivacyComponent) },
  { path: 'faq', loadComponent: () => import('./pages/faq/faq.components').then(m => m.FaqComponent) },
  { path: 'feedback', loadComponent: () => import('./pages/feedback/feedback.component').then(m => m.FeedbackComponent) },
  { path: '**', redirectTo: '' }
];
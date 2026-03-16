import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const gameGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) {
    router.navigate(['/']);
    return false;
  }

  // Mindenki beléphet a /game-be aki be van jelentkezve
  // (ADMIN, PROMOTER, USER egyaránt)
  return true;
};
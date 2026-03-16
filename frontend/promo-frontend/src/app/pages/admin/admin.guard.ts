import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const role = localStorage.getItem('role');

  if (role === 'ADMIN') {
    return true;
  }

  // Ha be van jelentkezve de nem admin, visszaküldjük a játékba
  const token = localStorage.getItem('token');
  if (token) {
    router.navigate(['/game']);
  } else {
    router.navigate(['/']);
  }
  return false;
};
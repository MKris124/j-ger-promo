import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const promoterGuard: CanActivateFn = () => {
  const router = inject(Router);
  const role = localStorage.getItem('role');

  if (role === 'PROMOTER' || role === 'ADMIN') {
    return true;
  }

  const token = localStorage.getItem('token');
  if (token) {
    router.navigate(['/game']);
  } else {
    router.navigate(['/']);
  }
  return false;
};
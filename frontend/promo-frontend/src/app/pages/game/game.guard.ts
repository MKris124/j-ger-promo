import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

export const gameGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  if (!token) {
    // Ha nincs belépve, visszadobjuk a loginra, de ELMENTJÜK a query paraméterbe, hogy hova akart menni!
    router.navigate(['/'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Mindenki beléphet a védett oldalakra, aki be van jelentkezve
  // (ADMIN, PROMOTER, USER egyaránt)
  return true;
};
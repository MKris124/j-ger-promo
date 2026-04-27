import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  let authReq = req;
  if (token) {
    authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || error.status === 403) {
        console.warn('Esemény offline vagy lejárt munkamenet. Kijelentkezés...');
        
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('lastVisitedRoute');
        localStorage.removeItem('userName');
        localStorage.removeItem('userId');
        
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
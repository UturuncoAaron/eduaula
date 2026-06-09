import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const isLoginCall = req.url.includes('/auth/login');
      const isFichajeCall = req.url.includes('/fichaje');

      if (err.status === 401 && !isLoginCall && !isFichajeCall) {
        auth.logout();
        router.navigate(['/auth/login']);
      }

      return throwError(() => err);
    }),
  );
};
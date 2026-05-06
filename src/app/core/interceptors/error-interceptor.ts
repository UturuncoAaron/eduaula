import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth';

/**
 * Manejo centralizado de errores HTTP:
 *  - 401 (excepto en /auth/login): cierra sesión y redirige al login.
 *  - Re-emite el `HttpErrorResponse` original para que cada servicio
 *    parsee el mensaje según su contrato.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const isLoginCall = req.url.includes('/auth/login');
      if (err.status === 401 && !isLoginCall) {
        auth.logout();
        router.navigate(['/auth/login']);
      }
      return throwError(() => err);
    }),
  );
};

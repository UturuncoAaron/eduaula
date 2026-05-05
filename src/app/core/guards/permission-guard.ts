
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth';
import { Modulo, hasAnyModulo } from '../auth/modulos';

export const permissionGuard = (modulosRequeridos: Modulo[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.currentUser();
  if (!user) return router.createUrlTree(['/auth/login']);

  return hasAnyModulo(user.modulos, modulosRequeridos)
    ? true
    : router.createUrlTree(['/dashboard']);
};

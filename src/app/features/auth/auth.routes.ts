import { Routes } from '@angular/router';

export const authRoutes: Routes = [
    {
        path: 'login',
        loadComponent: () =>
            import('./login-split/login-split').then(m => m.LoginSplit),
    },
    {
        // Ruta de fallback al login anterior si necesitas comparar
        path: 'login-classic',
        loadComponent: () =>
            import('./login/login').then(m => m.Login),
    },
];
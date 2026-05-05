import { Routes } from '@angular/router';

export const authRoutes: Routes = [
    {
        path: 'login',
        loadComponent: () =>
            import('./login-split/login-split').then(m => m.LoginSplit),
    },
];
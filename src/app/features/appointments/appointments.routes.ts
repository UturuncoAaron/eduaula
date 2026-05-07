import { Routes } from '@angular/router';

/**
 * Rutas del módulo "Mis Citas".
 *
 * Punto de entrada compartido para alumno y padre. La página interna
 * (`MisCitas`) se adapta al rol detectado para presentar el flujo de
 * solicitud correspondiente.
 */
export const APPOINTMENTS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./pages/mis-citas/mis-citas').then(c => c.MisCitas),
    },
];

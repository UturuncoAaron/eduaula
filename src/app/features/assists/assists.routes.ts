import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission-guard';
import { MODULO } from '../../core/auth/modulos';

export const ASSISTS_ROUTES: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'general/scan' },
    {
        path: 'general/scan',
        canActivate: [permissionGuard([MODULO.ASIST_GENERAL])],
        loadComponent: () =>
            import('./qr-scan/qr-scan').then(c => c.QrScan),
        title: 'Escanear QR | EduAula',
    },
    {
        path: 'general/:seccionId',
        canActivate: [permissionGuard([MODULO.ASIST_GENERAL])],
        loadComponent: () =>
            import('./general/general-asistencia').then(m => m.GeneralAsistencia),
    },
    {
        path: 'curso',
        canActivate: [permissionGuard([MODULO.ASIST_CURSO])],
        loadComponent: () =>
            import('./asistencia-curso/asistencia-curso-list/asistencia-curso-list')
                .then(c => c.AsistenciaCursoList),
    },
    {
        path: 'curso/:cursoId',
        canActivate: [permissionGuard([MODULO.ASIST_CURSO])],
        loadComponent: () =>
            import('./asistencia-curso/asistencia-curso-detail/asistencia-curso-detail')
                .then(c => c.AsistenciaCursoDetail),
    },
];
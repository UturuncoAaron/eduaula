import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission-guard';
import { MODULO } from '../../core/auth/modulos';

/**
 * Rutas de asistencias.
 *
 * Hoy expone solo el flujo del docente (curso). Las pantallas de asistencia
 * general (tutor/auxiliar/admin), "mi asistencia" (alumno), reporte y scan QR
 * se irán agregando aquí en PRs siguientes.
 */
export const ASSISTS_ROUTES: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'curso',
    },

    // ─── Docente: pasa lista por curso ───────────────────────────────────
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

    // ─── Auxiliar: registrar asistencia a docentes por bloque del día ──────
    {
        path: 'docentes',
        loadComponent: () =>
            import('./asistencia-docentes/asistencia-docentes')
                .then(c => c.AsistenciaDocentes),
    },


    {
        path: 'general/:seccionId',              // ← esta es la que faltaba
        loadComponent: () =>
            import('./general/general-asistencia').then(m => m.GeneralAsistencia),
    },
    {
        path: 'docentes',
        loadComponent: () =>
            import('./docente/docente-asistencia').then(m => m.DocenteAsistencia),
    },
];

import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/services/api';
import {
    AsistenciaCursoRecord,
    AsistenciaGeneralRecord,
    BulkAsistenciaPayload,
    ListAsistenciasCursoPorAlumnoQuery,
    ListAsistenciasQuery,
    RegisterAsistenciaPayload,
    ReporteAsistenciaQuery,
    ReporteAsistenciaRow,
    ScanQrPayload,
    ScanQrResponse,
    UpdateAsistenciaPayload,
} from '../../../core/models/asistencia';

/**
 * Cliente HTTP para el módulo de asistencias.
 *
 * Wrapper sobre `/asistencias/*` (general + por curso + reporte + QR).
 * No mantiene estado: cada pantalla usa su propio `signal()` local.
 * Los DTOs/responses están en `core/models/asistencia.ts`.
 */
@Injectable({ providedIn: 'root' })
export class AssistsStore {
    private api = inject(ApiService);

    /** Convierte un objeto a query params descartando vacíos/null/undefined. */
    private toParams(q: object): Record<string, string> {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(q as Record<string, unknown>)) {
            if (v !== undefined && v !== null && v !== '') out[k] = String(v);
        }
        return out;
    }

    // ── Asistencia GENERAL (tutor / auxiliar / admin) ─────────────────────

    generalListBySeccion(seccionId: string, q: ListAsistenciasQuery = {}) {
        return this.api.get<AsistenciaGeneralRecord[]>(
            `asistencias/general/${seccionId}`,
            this.toParams(q),
        );
    }

    generalListByAlumno(alumnoId: string, q: ListAsistenciasQuery = {}) {
        return this.api.get<AsistenciaGeneralRecord[]>(
            `asistencias/general/alumno/${alumnoId}`,
            this.toParams(q),
        );
    }

    generalRegister(seccionId: string, body: RegisterAsistenciaPayload) {
        return this.api.post<AsistenciaGeneralRecord>(
            `asistencias/general/${seccionId}`,
            body,
        );
    }

    generalBulk(seccionId: string, body: BulkAsistenciaPayload) {
        return this.api.post<{ registrados: number }>(
            `asistencias/general/${seccionId}/bulk`,
            body,
        );
    }

    generalUpdate(id: string, body: UpdateAsistenciaPayload) {
        return this.api.patch<AsistenciaGeneralRecord>(`asistencias/general/${id}`, body);
    }

    generalRemove(id: string) {
        return this.api.delete<{ ok: boolean }>(`asistencias/general/${id}`);
    }

    /** Escaneo de QR del carnet del alumno (solo auxiliar / admin). */
    generalScan(body: ScanQrPayload) {
        return this.api.post<ScanQrResponse>('asistencias/general/scan', body);
    }

    // ── Asistencia POR CURSO (docente del curso / admin) ──────────────────

    classListByCurso(cursoId: string, q: ListAsistenciasQuery = {}) {
        return this.api.get<AsistenciaCursoRecord[]>(
            `asistencias/curso/${cursoId}`,
            this.toParams(q),
        );
    }

    classListByAlumno(alumnoId: string, q: ListAsistenciasCursoPorAlumnoQuery = {}) {
        return this.api.get<AsistenciaCursoRecord[]>(
            `asistencias/curso/alumno/${alumnoId}`,
            this.toParams(q),
        );
    }

    classRegister(cursoId: string, body: RegisterAsistenciaPayload) {
        return this.api.post<AsistenciaCursoRecord>(`asistencias/curso/${cursoId}`, body);
    }

    classBulk(cursoId: string, body: BulkAsistenciaPayload) {
        return this.api.post<{ registrados: number }>(
            `asistencias/curso/${cursoId}/bulk`,
            body,
        );
    }

    classUpdate(id: string, body: UpdateAsistenciaPayload) {
        return this.api.patch<AsistenciaCursoRecord>(`asistencias/curso/${id}`, body);
    }

    classRemove(id: string) {
        return this.api.delete<{ ok: boolean }>(`asistencias/curso/${id}`);
    }

    // ── Reporte agregado ──────────────────────────────────────────────────

    reporte(q: ReporteAsistenciaQuery) {
        return this.api.get<ReporteAsistenciaRow[]>(
            'asistencias/reporte',
            this.toParams(q),
        );
    }
}

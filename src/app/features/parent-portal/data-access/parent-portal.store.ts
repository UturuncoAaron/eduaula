import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/services/api';
import type {
    Announcement,
    AttendanceGeneralPayload,
    Child,
    ChildLibreta,
    CursoGradesGroup,
    ScheduleSlot,
} from '../../../core/models/parent-portal';

// Reexportar para que componentes que ya importan desde el store no rompan
export type {
    Announcement,
    AttendanceGeneralDetalle,
    AttendanceGeneralPayload,
    AttendanceGeneralResumen,
    Child,
    ChildLibreta,
    CursoGradesGroup,
    NotaItem,
    ScheduleSlot,
} from '../../../core/models/parent-portal';

export interface GradesQuery {
    anio?: number;
    periodoId?: string;
}

export interface AttendanceQuery {
    anio?: number;
    periodoId?: string;
}

@Injectable({ providedIn: 'root' })
export class ParentPortalService {
    private api = inject(ApiService);

    /** Lista de hijos vinculados al padre autenticado. */
    getChildren() {
        return this.api.get<Child[]>('parent/children');
    }

    /**
     * Notas del hijo agrupadas por curso.
     * Filtros opcionales: anio (default = año del periodo activo), periodoId (UUID).
     */
    getChildGrades(childId: string, query?: GradesQuery) {
        const params: Record<string, string> = {};
        if (query?.anio) params['anio'] = String(query.anio);
        if (query?.periodoId) params['periodoId'] = query.periodoId;
        return this.api.get<CursoGradesGroup[]>(`parent/children/${childId}/grades`, params);
    }

    /**
     * Asistencia general diaria del hijo (registrada por el auxiliar).
     * Devuelve resumen de conteos + detalle cronológico.
     */
    getChildAttendance(childId: string, query?: AttendanceQuery) {
        const params: Record<string, string> = {};
        if (query?.anio) params['anio'] = String(query.anio);
        if (query?.periodoId) params['periodoId'] = query.periodoId;
        return this.api.get<AttendanceGeneralPayload>(
            `parent/children/${childId}/attendance`,
            params,
        );
    }

    /** Horario semanal del hijo. */
    getChildSchedule(childId: string) {
        return this.api.get<ScheduleSlot[]>(`parent/children/${childId}/schedule`);
    }

    /** Libretas del hijo con URL firmada lista para abrir. */
    getChildLibretas(childId: string) {
        return this.api.get<ChildLibreta[]>(`libretas/hijo/${childId}`);
    }

    /** Comunicados visibles para el padre. */
    getAnnouncementsForParent() {
        return this.api.get<Announcement[]>('announcements', { activo: 'true' });
    }
}
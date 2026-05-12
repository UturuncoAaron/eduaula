import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/services/api';
import {
    Announcement,
    Child,
    ChildAttendanceRecord,
    ChildGrade,
    ChildLibreta,
} from '../../../core/models/parent-portal';

export interface AttendanceGeneralResumen {
    total: number;
    asistio: number;
    tardanza: number;
    justificado: number;
    falta: number;
    porcentaje: number | null;
}
export interface AttendanceGeneralDetalle {
    id: string;
    fecha: string;
    estado: string;
    observacion: string | null;
    periodo_nombre: string;
    periodo_anio: number;
    periodo_bimestre: number;
}
export interface AttendanceGeneralPayload {
    resumen: AttendanceGeneralResumen;
    detalle: AttendanceGeneralDetalle[];
}

export interface ScheduleSlot {
    diaSemana: string;
    horaInicio: string;
    horaFin: string;
    curso: string;
    aula: string | null;
    docente: string | null;
}

@Injectable({ providedIn: 'root' })
export class ParentPortalService {
    private api = inject(ApiService);

    /** Lista de hijos vinculados al padre autenticado. */
    getChildren() {
        return this.api.get<Child[]>('parent/children');
    }

    /** Notas del hijo (acceso protegido por backend). */
    getChildGrades(childId: string) {
        return this.api.get<ChildGrade[]>(`parent/children/${childId}/grades`);
    }

    /** Asistencia del hijo a clases en vivo (legacy). */
    getChildAttendance(childId: string) {
        return this.api.get<ChildAttendanceRecord[]>(
            `parent/children/${childId}/attendance`,
        );
    }

    /** Asistencia general diaria (entrada/tutor). */
    getChildAttendanceGeneral(childId: string) {
        return this.api.get<AttendanceGeneralPayload>(
            `parent/children/${childId}/attendance-general`,
        );
    }

    /** Horario semanal del hijo. */
    getChildSchedule(childId: string) {
        return this.api.get<ScheduleSlot[]>(
            `parent/children/${childId}/schedule`,
        );
    }

    /**
     * Libretas del hijo. Usa /api/libretas/hijo/:alumnoId que devuelve
     * cada libreta con `url` firmada lista para abrir en navegador.
     */
    getChildLibretas(childId: string) {
        return this.api.get<ChildLibreta[]>(`libretas/hijo/${childId}`);
    }

    /** Comunicados visibles para el padre (todos + específicos para padres). */
    getAnnouncementsForParent() {
        return this.api.get<Announcement[]>('announcements', { activo: 'true' });
    }
}

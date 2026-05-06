import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/services/api';
import {
    Announcement,
    Child,
    ChildAttendanceRecord,
    ChildGrade,
    ChildLibreta,
} from '../../../core/models/parent-portal';

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

    /** Asistencia del hijo (acceso protegido por backend). */
    getChildAttendance(childId: string) {
        return this.api.get<ChildAttendanceRecord[]>(
            `parent/children/${childId}/attendance`,
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

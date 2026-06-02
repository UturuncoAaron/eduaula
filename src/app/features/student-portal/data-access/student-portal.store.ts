import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api';
import type { ArchivoPsicologico } from '../../../core/models/psychology';

export interface StudentInforme {
    id: string;
    tipo: string;
    titulo: string;
    finalizadoAt: string | null;
    psicologaNombre: string;
}

@Injectable({ providedIn: 'root' })
export class StudentPortalStore {
    private readonly api = inject(ApiService);

    getInformes(): Observable<StudentInforme[]> {
        return this.api.get<StudentInforme[]>('student/psicologia/informes').pipe(
            map(r => r.data ?? []),
        );
    }

    getArchivos(categoria?: 'ficha' | 'test'): Observable<ArchivoPsicologico[]> {
        const params: Record<string, string> = {};
        if (categoria) params['categoria'] = categoria;
        return this.api.get<ArchivoPsicologico[]>('student/psicologia/archivos', params).pipe(
            map(r => r.data ?? []),
        );
    }

    getArchivoUrl(archivoId: string): Observable<{ url: string }> {
        return this.api.get<{ url: string }>(`student/psicologia/archivos/${archivoId}/url`).pipe(
            map(r => r.data),
        );
    }

    getInformePdfUrl(informeId: string): string {
        return `${this.api.base}/student/psicologia/informes/${informeId}/pdf`;
    }
}
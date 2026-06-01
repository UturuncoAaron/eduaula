import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api';
import type {
    DocenteDelDia,
    RegistroDocentePayload,
    ReporteDocenteRow,
    ResumenDocenteRow,
    ReporteDocenteFilters,
    MarcarSalidaPayload,
} from '../models/asistencia-docentes';

@Injectable({ providedIn: 'root' })
export class AsistenciaDocentesService {
    private readonly api = inject(ApiService);

    // ── Tab 1: Registro ────────────────────────────────────────────────────

    getDocentesDelDia(fecha: string): Observable<DocenteDelDia[]> {
        return this.api.get<DocenteDelDia[]>('asistencias/docente/dia', { fecha }).pipe(
            map(r => r.data.map(d => ({
                ...d,
                bloques_json: typeof d.bloques_json === 'string'
                    ? JSON.parse(d.bloques_json)
                    : (d.bloques_json ?? []),
            }))),
        );
    }

    registrarBulk(fecha: string, docentes: RegistroDocentePayload[]): Observable<void> {
        return this.api.post<void>('asistencias/docente/registrar', { fecha, docentes }).pipe(
            map(() => void 0),
        );
    }

    marcarSalida(payload: MarcarSalidaPayload): Observable<{ ok: boolean; hora_salida: string }> {
        return this.api.patch<{ ok: boolean; hora_salida: string }>(
            'asistencias/docente/salida',
            payload,
        ).pipe(map(r => r.data));
    }

    // ── Tab 2: Reportes ────────────────────────────────────────────────────

    getReporteDiario(fecha: string): Observable<ReporteDocenteRow[]> {
        return this.api.get<ReporteDocenteRow[]>('reports/docentes/diario', { fecha }).pipe(
            map(r => r.data),
        );
    }

    getResumenRango(fechaInicio: string, fechaFin: string): Observable<ResumenDocenteRow[]> {
        return this.api.get<ResumenDocenteRow[]>('reports/docentes/resumen', {
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
        }).pipe(map(r => r.data));
    }

    descargarExcel(filters: ReporteDocenteFilters): void {
        const { fechaInicio, fechaFin } = this.resolverRango(filters);
        if (filters.tipo === 'dia') {
            this._descargar(
                'reports/docentes/diario',
                { fecha: fechaInicio, format: 'xlsx' },
                `asist_docentes_${fechaInicio}.xlsx`,
            );
        } else {
            this._descargar(
                'reports/docentes/resumen',
                { fecha_inicio: fechaInicio, fecha_fin: fechaFin, format: 'xlsx' },
                `resumen_docentes_${fechaInicio}_${fechaFin}.xlsx`,
            );
        }
    }

    getAniosLectivos(): Observable<number[]> {
        return this.api.get<{ anio: number }>('academic-years/current').pipe(
            map(r => [r.data.anio]),
        );
    }

    resolverRango(filters: ReporteDocenteFilters): { fechaInicio: string; fechaFin: string } {
        if (filters.tipo === 'dia' && filters.fecha) {
            return { fechaInicio: filters.fecha, fechaFin: filters.fecha };
        }
        if (filters.fecha_inicio && filters.fecha_fin) {
            return { fechaInicio: filters.fecha_inicio, fechaFin: filters.fecha_fin };
        }
        const hoy = new Date().toISOString().slice(0, 10);
        return { fechaInicio: hoy, fechaFin: hoy };
    }

    private _descargar(path: string, params: Record<string, string>, filename: string): void {
        this.api.getBlob(path, params).subscribe(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        });
    }
}
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import type {
  SeccionResumenResponse,
  HorarioDelDia,
  RegistrarAsistenciaDocenteDto,
  RegistrarBulkDto,
  BulkResult,
  AsistenciaDocenteDiaria,
  ResumenAsistenciaDocente,
  AlertaAusenciaDocente,
} from '../models/reports';
import { ApiService } from './api';
import { environment } from '../../../environments/environment';

/**
 * ReportsService
 *
 * Centraliza todas las llamadas HTTP del módulo de reportes.
 * - Para JSON usa ApiService (que ya pasa por el auth-interceptor).
 * - Para descargas binarias usa HttpClient con responseType: 'blob'
 *   contra environment.apiUrl. El auth-interceptor también lo intercepta
 *   y agrega el Bearer token automáticamente — no hay que tocar headers
 *   ni leer el token de localStorage manualmente.
 */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private api = inject(ApiService);
  private http = inject(HttpClient);

  // ─── Reporte maestro de sección ────────────────────────────────────────────

  getSeccionResumen(
    seccionId: string,
    periodoId: string,
    umbral = 11,
  ): Observable<SeccionResumenResponse> {
    const qs = new URLSearchParams({
      periodo_id: periodoId,
      umbral: String(umbral),
    }).toString();
    return this.api
      .get<SeccionResumenResponse>(`reports/seccion/${seccionId}/resumen?${qs}`)
      .pipe(map((r: any) => r.data));
  }

  // ─── Exportación CSV/XLSX ──────────────────────────────────────────────────

  downloadGradesCsv(params: {
    periodo_id?: string;
    bimestre?: number;
    grado_id?: string;
    seccion_id?: string;
  }): Observable<void> {
    let httpParams = new HttpParams();
    if (params.periodo_id) httpParams = httpParams.set('periodo_id', params.periodo_id);
    if (params.bimestre) httpParams = httpParams.set('bimestre', String(params.bimestre));
    if (params.grado_id) httpParams = httpParams.set('grado_id', params.grado_id);
    if (params.seccion_id) httpParams = httpParams.set('seccion_id', params.seccion_id);

    return this.http
      .get(`${environment.apiUrl}/admin/reports/grades/export`, {
        params: httpParams,
        responseType: 'blob',
      })
      .pipe(
        tap((blob) => {
          const label = params.bimestre ? `bimestre${params.bimestre}` : 'todos';
          triggerDownload(blob, `notas_${label}.csv`);
        }),
        map(() => void 0),
      );
  }

  downloadSeccionXlsx(seccionId: string, periodoId: string): Observable<void> {
    const httpParams = new HttpParams()
      .set('periodo_id', periodoId)
      .set('format', 'xlsx');

    return this.http
      .get(`${environment.apiUrl}/reports/seccion/${seccionId}/resumen`, {
        params: httpParams,
        responseType: 'blob',
      })
      .pipe(
        tap((blob) => triggerDownload(blob, `reporte_seccion_${seccionId}.xlsx`)),
        map(() => void 0),
      );
  }

  // ─── Asistencia docentes ───────────────────────────────────────────────────

  getHorariosDia(fecha: string): Observable<HorarioDelDia[]> {
    const qs = new URLSearchParams({ fecha }).toString();
    return this.api
      .get<HorarioDelDia[]>(`reports/docentes/horarios-dia?${qs}`)
      .pipe(map((r: any) => r.data));
  }

  registrarAsistenciaDocente(
    dto: RegistrarAsistenciaDocenteDto,
  ): Observable<{ id: string }> {
    return this.api
      .post<{ id: string }>('reports/docentes/registrar', dto)
      .pipe(map((r: any) => r.data));
  }

  registrarAsistenciaBulk(dto: RegistrarBulkDto): Observable<BulkResult> {
    return this.api
      .post<BulkResult>('reports/docentes/registrar/bulk', dto)
      .pipe(map((r: any) => r.data));
  }

  getReporteDiarioDocentes(fecha: string): Observable<AsistenciaDocenteDiaria[]> {
    const qs = new URLSearchParams({ fecha }).toString();
    return this.api
      .get<AsistenciaDocenteDiaria[]>(`reports/docentes/diario?${qs}`)
      .pipe(map((r: any) => r.data));
  }

  getResumenDocentes(
    fechaInicio: string,
    fechaFin: string,
  ): Observable<ResumenAsistenciaDocente[]> {
    const qs = new URLSearchParams({
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    }).toString();
    return this.api
      .get<ResumenAsistenciaDocente[]>(`reports/docentes/resumen?${qs}`)
      .pipe(map((r: any) => r.data));
  }

  getAlertasDocentes(
    fechaInicio: string,
    fechaFin: string,
    limit = 10,
  ): Observable<AlertaAusenciaDocente[]> {
    const qs = new URLSearchParams({
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      limit: String(limit),
    }).toString();
    return this.api
      .get<AlertaAusenciaDocente[]>(`reports/docentes/alertas?${qs}`)
      .pipe(map((r: any) => r.data));
  }

  downloadReporteDiarioXlsx(fecha: string): Observable<void> {
    const httpParams = new HttpParams()
      .set('fecha', fecha)
      .set('format', 'xlsx');

    return this.http
      .get(`${environment.apiUrl}/reports/docentes/diario`, {
        params: httpParams,
        responseType: 'blob',
      })
      .pipe(
        tap((blob) => triggerDownload(blob, `asist_docentes_${fecha}.xlsx`)),
        map(() => void 0),
      );
  }
}

// ─── Utilidad local ──────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

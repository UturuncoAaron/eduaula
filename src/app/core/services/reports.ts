import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ReportFormat = 'json' | 'xlsx' | 'pdf';
export type EscalaCalificacion = 'AD' | 'A' | 'B' | 'C' | 'Sin notas';
export type EstadoAsistenciaAlumno = 'asistio' | 'falta' | 'tardanza' | 'justificado' | 'sin-registro';
export type EstadoAsistenciaDocente = 'presente' | 'tardanza' | 'ausente' | 'permiso' | 'licencia' | 'sin-registro';
export type CategoriaRendimiento = 'top' | 'normal' | 'riesgo' | 'sin-datos';

export interface SeccionResumenResponse {
  seccion: any;
  periodo: any;
  ranking: any[];
  notas_por_curso: any[];
  resumen_asistencia: any[];
  top_inasistentes: any[];
  entregas_por_tarea: any[];
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private http = inject(HttpClient);

  getSeccionResumen(seccionId: string, periodoId: string, umbral = 11, anio?: number): Observable<SeccionResumenResponse> {
    let httpParams = new HttpParams()
      .set('scope', 'section_summary')
      .set('format', 'json')
      .set('seccion_id', seccionId)
      .set('periodo_id', periodoId)
      .set('umbral', String(umbral));

    if (anio) {
      httpParams = httpParams.set('anio', String(anio));
    }

    return this.http.get<SeccionResumenResponse>(`${environment.apiUrl}/admin/reports/consolidated`, { params: httpParams });
  }

  getHorariosDia(fecha: string): Observable<any[]> {
    const httpParams = new HttpParams().set('fecha', fecha);
    return this.http.get<any>(`${environment.apiUrl}/reports/docentes/horarios-dia`, { params: httpParams }).pipe(map(r => r.data ?? r));
  }

  registrarAsistenciaDocente(dto: any): Observable<{ id: string }> {
    return this.http.post<any>(`${environment.apiUrl}/reports/docentes/registrar`, dto).pipe(map(r => r.data ?? r));
  }

  registrarAsistenciaBulk(dto: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/reports/docentes/registrar/bulk`, dto).pipe(map(r => r.data ?? r));
  }

  getReporteDiarioDocentes(fecha: string): Observable<any[]> {
    const httpParams = new HttpParams().set('fecha', fecha);
    return this.http.get<any>(`${environment.apiUrl}/reports/docentes/diario`, { params: httpParams }).pipe(map(r => r.data ?? r));
  }

  getResumenDocentes(fechaInicio: string, fechaFin: string, anio?: number): Observable<any[]> {
    let httpParams = new HttpParams()
      .set('scope', 'teacher_attendance_range')
      .set('format', 'json')
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);

    if (anio) {
      httpParams = httpParams.set('anio', String(anio));
    }

    return this.http.get<any>(`${environment.apiUrl}/admin/reports/consolidated`, { params: httpParams }).pipe(map(r => r.data ?? r));
  }

  getAlertasDocentes(fechaInicio: string, fechaFin: string, limit = 10): Observable<any[]> {
    const httpParams = new HttpParams()
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin)
      .set('limit', String(limit));
    return this.http.get<any>(`${environment.apiUrl}/reports/docentes/alertas`, { params: httpParams }).pipe(map(r => r.data ?? r));
  }

  downloadConsolidatedReport(params: any): Observable<Blob> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        httpParams = httpParams.set(key, String(params[key]));
      }
    });

    return this.http.get(`${environment.apiUrl}/admin/reports/consolidated`, {
      params: httpParams,
      responseType: 'blob'
    });
  }
}
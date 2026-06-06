import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private http = inject(HttpClient);

  getSeccionResumen(seccionId: string, periodoId: string, umbral = 11, anio?: number): Observable<any> {
    let httpParams = new HttpParams()
      .set('scope', 'section_summary')
      .set('format', 'json')
      .set('seccion_id', seccionId)
      .set('periodo_id', periodoId)
      .set('umbral', String(umbral));

    if (anio) httpParams = httpParams.set('anio', String(anio));

    return this.http.get<any>(`${environment.apiUrl}/admin/reports/consolidated`, { params: httpParams });
  }

  getHorariosDia(fecha: string): Observable<any[]> {
    const httpParams = new HttpParams().set('fecha', fecha);
    return this.http.get<any>(`${environment.apiUrl}/admin/reports/docentes/horarios-dia`, { params: httpParams })
      .pipe(map((r: any) => r.data ?? r));
  }

  registrarAsistenciaDocente(dto: any): Observable<{ id: string }> {
    return this.http.post<any>(`${environment.apiUrl}/admin/reports/docentes/registrar`, dto)
      .pipe(map((r: any) => r.data ?? r));
  }

  registrarAsistenciaBulk(dto: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/admin/reports/docentes/registrar/bulk`, dto)
      .pipe(map((r: any) => r.data ?? r));
  }

  getReporteDiarioDocentes(fecha: string): Observable<any[]> {
    const httpParams = new HttpParams().set('fecha', fecha);
    return this.http.get<any>(`${environment.apiUrl}/admin/reports/docentes/diario`, { params: httpParams })
      .pipe(map((r: any) => r.data ?? r));
  }

  getResumenDocentes(fechaInicio: string, fechaFin: string, cuentaId?: string): Observable<any[]> {
    let httpParams = new HttpParams()
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);
    if (cuentaId) httpParams = httpParams.set('cuenta_id', cuentaId);
    return this.http.get<any[]>(`${environment.apiUrl}/reports/asistencias/teachers`, { params: httpParams })
      .pipe(map((r: any) => r.data ?? r));
  }

  getAlertasDocentes(fechaInicio: string, fechaFin: string, limit = 10): Observable<any[]> {
    const httpParams = new HttpParams()
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin)
      .set('limit', String(limit));
    return this.http.get<any>(`${environment.apiUrl}/admin/reports/docentes/alertas`, { params: httpParams })
      .pipe(map((r: any) => r.data ?? r));
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
      responseType: 'blob',
    });
  }

  getResumenStaff(fechaInicio: string, fechaFin: string, cuentaId?: string): Observable<any[]> {
    let httpParams = new HttpParams()
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);
    if (cuentaId) httpParams = httpParams.set('cuenta_id', cuentaId);
    return this.http.get<any[]>(`${environment.apiUrl}/reports/asistencias/staff`, { params: httpParams })
      .pipe(map((r: any) => r.data ?? r));
  }

  // ── NUEVO: reporte consolidado de todo el personal ──────────────────────────
  downloadPersonalReport(
    fechaInicio: string,
    fechaFin: string,
    rol?: string,
  ): Observable<Blob> {
    let httpParams = new HttpParams()
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin)
      .set('format', 'xlsx');

    if (rol) httpParams = httpParams.set('rol', rol);

    return this.http.get(`${environment.apiUrl}/reports/asistencias/personal`, {
      params: httpParams,
      responseType: 'blob',
    });
  }
}
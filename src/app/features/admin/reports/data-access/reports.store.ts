import { Injectable, inject, signal, computed } from '@angular/core';
import type {
    SeccionResumenResponse,
    HorarioDelDia,
    AsistenciaDocenteDiaria,
    ResumenAsistenciaDocente,
    AlertaAusenciaDocente,
    RegistrarBulkDto,
    BulkResult,
    ResumenAsistenciaStaff
} from '../../../../core/models/reports';
import { ReportsService } from '@core/services/reports';

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
export type ExportFormat = 'xlsx' | 'pdf' | 'csv' | 'json';

@Injectable({ providedIn: 'root' })
export class ReportsStore {
    private svc = inject(ReportsService);

    readonly seccionResumen = signal<SeccionResumenResponse | null>(null);
    readonly seccionLoading = signal<LoadingState>('idle');
    readonly seccionError = signal<string | null>(null);
    readonly filtroSeccionId = signal<string>('');
    readonly filtroPeriodoId = signal<string>('');
    readonly filtroUmbral = signal<number>(11);
    readonly filtroAnio = signal<number | undefined>(undefined);

    readonly alumnosEnRiesgo = computed(() =>
        this.seccionResumen()?.ranking.filter((a) => a.categoria === 'riesgo') ?? []
    );

    readonly promedioEntregas = computed(() => {
        const tareas = this.seccionResumen()?.entregas_por_tarea ?? [];
        if (!tareas.length) return null;
        const sum = tareas.reduce(
            (acc, t) => acc + (parseFloat(t.porcentaje_entrega ?? '0') || 0), 0
        );
        return (sum / tareas.length).toFixed(1);
    });

    readonly horariosDia = signal<HorarioDelDia[]>([]);
    readonly horariosFecha = signal<string>('');
    readonly horariosLoading = signal<LoadingState>('idle');

    readonly bloquesPendientes = computed(
        () => this.horariosDia().filter((h) => h.estado_actual === 'sin-registro').length
    );

    readonly docentesAusentes = computed(
        () => this.horariosDia().filter((h) => h.estado_actual === 'falto').length,
    );

    readonly reporteDiario = signal<AsistenciaDocenteDiaria[]>([]);
    readonly resumenDocentes = signal<ResumenAsistenciaDocente[]>([]);
    readonly alertasDocentes = signal<AlertaAusenciaDocente[]>([]);

    readonly resumenStaff = signal<ResumenAsistenciaStaff[]>([]);
    readonly reporteLoading = signal<LoadingState>('idle');

    readonly downloading = signal(false);

    loadSeccionResumen(seccionId: string, periodoId: string, umbral = 11, anio?: number): void {
        if (!seccionId || !periodoId) return;
        this.filtroSeccionId.set(seccionId);
        this.filtroPeriodoId.set(periodoId);
        this.filtroUmbral.set(umbral);
        this.filtroAnio.set(anio);
        this.seccionLoading.set('loading');
        this.seccionError.set(null);

        this.svc.getSeccionResumen(seccionId, periodoId, umbral, anio).subscribe({
            next: (data) => {
                this.seccionResumen.set(data);
                this.seccionLoading.set('success');
            },
            error: (err) => {
                this.seccionError.set(err?.error?.message ?? 'Error al cargar el reporte');
                this.seccionLoading.set('error');
            }
        });
    }

    loadHorariosDia(fecha: string): void {
        this.horariosFecha.set(fecha);
        this.horariosLoading.set('loading');
        this.svc.getHorariosDia(fecha).subscribe({
            next: (data) => { this.horariosDia.set(data); this.horariosLoading.set('success'); },
            error: () => this.horariosLoading.set('error')
        });
    }

    actualizarHorarioLocal(horarioId: string, cambios: Partial<HorarioDelDia>): void {
        this.horariosDia.update((lista) =>
            lista.map((h) => (h.horario_id === horarioId ? { ...h, ...cambios } : h))
        );
    }

    registrarBulk(dto: RegistrarBulkDto): Promise<BulkResult> {
        return new Promise((resolve, reject) => {
            this.svc.registrarAsistenciaBulk(dto).subscribe({ next: resolve, error: reject });
        });
    }

    loadReporteDiario(fecha: string): void {
        this.reporteLoading.set('loading');
        this.svc.getReporteDiarioDocentes(fecha).subscribe({
            next: (d) => { this.reporteDiario.set(d); this.reporteLoading.set('success'); },
            error: () => { this.reporteDiario.set([]); this.reporteLoading.set('error'); }
        });
    }

    loadResumenDocentes(fi: string, ff: string, anio?: number): void {
        this.reporteLoading.set('loading');
        this.svc.getResumenDocentes(fi, ff, anio).subscribe({
            next: (d) => {
                if (Array.isArray(d)) {
                    this.resumenDocentes.set(d);
                    this.reporteLoading.set('success');
                } else {
                    console.warn('getResumenDocentes no retornó un Array:', d);
                    this.resumenDocentes.set([]);
                    this.reporteLoading.set('error');
                }
            },
            error: (err) => {
                console.error('Error HTTP en loadResumenDocentes:', err);
                this.resumenDocentes.set([]);
                this.reporteLoading.set('error');
            }
        });
    }

    loadResumenStaff(fi: string, ff: string, anio?: number): void {
        this.reporteLoading.set('loading');
        this.svc.getResumenStaff(fi, ff, anio).subscribe({
            next: (d) => {
                if (Array.isArray(d)) {
                    this.resumenStaff.set(d);
                    this.reporteLoading.set('success');
                } else {
                    console.warn('getResumenStaff no retornó un Array:', d);
                    this.resumenStaff.set([]);
                    this.reporteLoading.set('error');
                }
            },
            error: (err) => {
                console.error('Error HTTP en loadResumenStaff:', err);
                this.resumenStaff.set([]);
                this.reporteLoading.set('error');
            }
        });
    }

    loadAlertas(fi: string, ff: string): void {
        this.svc.getAlertasDocentes(fi, ff).subscribe({
            next: (d) => this.alertasDocentes.set(d)
        });
    }

    executeSecureDownload(scope: string, format: ExportFormat, extraParams: Record<string, any> = {}): void {
        this.downloading.set(true);
        const consolidatedParams = {
            scope,
            format,
            anio: this.filtroAnio(),
            ...extraParams
        };

        this.svc.downloadConsolidatedReport(consolidatedParams).subscribe({
            next: (blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `reporte_${scope}_${consolidatedParams.anio ?? 'activo'}.${format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                this.downloading.set(false);
            },
            error: () => this.downloading.set(false)
        });
    }

    downloadCsv(params: { periodo_id?: string; bimestre?: number; grado_id?: string; seccion_id?: string }): void {
        this.executeSecureDownload('academic_general', 'csv', params);
    }

    downloadXlsx(seccionId: string, periodoId: string): void {
        this.executeSecureDownload('section_summary', 'xlsx', { seccion_id: seccionId, periodo_id: periodoId });
    }

    downloadPdf(seccionId: string, periodoId: string): void {
        this.executeSecureDownload('section_summary', 'pdf', { seccion_id: seccionId, periodo_id: periodoId });
    }
}
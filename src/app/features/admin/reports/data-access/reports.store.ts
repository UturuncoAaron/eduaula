import { Injectable, inject, signal, computed } from '@angular/core';

import type {
    SeccionResumenResponse,
    HorarioDelDia,
    AsistenciaDocenteDiaria,
    ResumenAsistenciaDocente,
    AlertaAusenciaDocente,
    RegistrarBulkDto,
    BulkResult,
} from '../../../../core/models/reports';
import { ReportsService } from '@core/services/reports';

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class ReportsStore {
    private svc = inject(ReportsService);

    // ─── Reporte maestro de sección ──────────────────────────────────────────

    readonly seccionResumen = signal<SeccionResumenResponse | null>(null);
    readonly seccionLoading = signal<LoadingState>('idle');
    readonly seccionError = signal<string | null>(null);
    readonly filtroSeccionId = signal<string>('');
    readonly filtroPeriodoId = signal<string>('');
    readonly filtroUmbral = signal<number>(11);

    readonly alumnosEnRiesgo = computed(() =>
        this.seccionResumen()?.ranking.filter((a) => a.categoria === 'riesgo') ?? [],
    );

    readonly promedioEntregas = computed(() => {
        const tareas = this.seccionResumen()?.entregas_por_tarea ?? [];
        if (!tareas.length) return null;
        const sum = tareas.reduce(
            (acc, t) => acc + (parseFloat(t.porcentaje_entrega ?? '0') || 0), 0,
        );
        return (sum / tareas.length).toFixed(1);
    });

    loadSeccionResumen(seccionId: string, periodoId: string, umbral = 11): void {
        if (!seccionId || !periodoId) return;
        this.filtroSeccionId.set(seccionId);
        this.filtroPeriodoId.set(periodoId);
        this.filtroUmbral.set(umbral);
        this.seccionLoading.set('loading');
        this.seccionError.set(null);

        this.svc.getSeccionResumen(seccionId, periodoId, umbral).subscribe({
            next: (data) => {
                this.seccionResumen.set(data);
                this.seccionLoading.set('success');
            },
            error: (err) => {
                this.seccionError.set(err?.error?.message ?? 'Error al cargar el reporte');
                this.seccionLoading.set('error');
            },
        });
    }

    // ─── Asistencia docentes ──────────────────────────────────────────────────

    readonly horariosDia = signal<HorarioDelDia[]>([]);
    readonly horariosFecha = signal<string>('');
    readonly horariosLoading = signal<LoadingState>('idle');

    readonly bloquesPendientes = computed(
        () => this.horariosDia().filter((h) => h.estado_actual === 'sin-registro').length,
    );

    readonly docentesAusentes = computed(
        () => this.horariosDia().filter((h) =>
            ['ausente', 'permiso', 'licencia'].includes(h.estado_actual)).length,
    );

    loadHorariosDia(fecha: string): void {
        this.horariosFecha.set(fecha);
        this.horariosLoading.set('loading');
        this.svc.getHorariosDia(fecha).subscribe({
            next: (data) => { this.horariosDia.set(data); this.horariosLoading.set('success'); },
            error: () => this.horariosLoading.set('error'),
        });
    }

    actualizarHorarioLocal(horarioId: string, cambios: Partial<HorarioDelDia>): void {
        this.horariosDia.update((lista) =>
            lista.map((h) => (h.horario_id === horarioId ? { ...h, ...cambios } : h)),
        );
    }

    registrarBulk(dto: RegistrarBulkDto): Promise<BulkResult> {
        return new Promise((resolve, reject) => {
            this.svc.registrarAsistenciaBulk(dto).subscribe({ next: resolve, error: reject });
        });
    }

    // ─── Reportes de docentes ─────────────────────────────────────────────────

    readonly reporteDiario = signal<AsistenciaDocenteDiaria[]>([]);
    readonly resumenDocentes = signal<ResumenAsistenciaDocente[]>([]);
    readonly alertasDocentes = signal<AlertaAusenciaDocente[]>([]);
    readonly reporteLoading = signal<LoadingState>('idle');

    loadReporteDiario(fecha: string): void {
        this.reporteLoading.set('loading');
        this.svc.getReporteDiarioDocentes(fecha).subscribe({
            next: (d) => { this.reporteDiario.set(d); this.reporteLoading.set('success'); },
            error: () => this.reporteLoading.set('error'),
        });
    }

    loadResumenDocentes(fi: string, ff: string): void {
        this.reporteLoading.set('loading');
        this.svc.getResumenDocentes(fi, ff).subscribe({
            next: (d) => { this.resumenDocentes.set(d); this.reporteLoading.set('success'); },
            error: () => this.reporteLoading.set('error'),
        });
    }

    loadAlertas(fi: string, ff: string): void {
        this.svc.getAlertasDocentes(fi, ff).subscribe({
            next: (d) => this.alertasDocentes.set(d),
        });
    }

    // ─── Descargas ────────────────────────────────────────────────────────────

    readonly downloading = signal(false);

    downloadCsv(params: { periodo_id?: string; bimestre?: number; grado_id?: string; seccion_id?: string }): void {
        this.downloading.set(true);
        this.svc.downloadGradesCsv(params).subscribe({
            next: () => this.downloading.set(false),
            error: () => this.downloading.set(false),
        });
    }

    downloadXlsx(seccionId: string, periodoId: string): void {
        this.downloading.set(true);
        this.svc.downloadSeccionXlsx(seccionId, periodoId).subscribe({
            next: () => this.downloading.set(false),
            error: () => this.downloading.set(false),
        });
    }
}
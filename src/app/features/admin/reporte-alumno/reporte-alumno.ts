import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../core/services/api';
import { UserAvatar } from '../../../shared/components/user-avatar/user-avatar';
import { environment } from '../../../../environments/environment';

interface PersonalData {
    id: string; codigo_estudiante: string; nombre: string;
    apellido_paterno: string; apellido_materno: string | null;
    fecha_nacimiento: string | null; telefono: string | null; email: string | null;
    inclusivo: boolean; foto_url: string | null; foto_storage_key: string | null;
    numero_documento: string | null; tipo_documento: string | null;
    activo: boolean; anio_ingreso: number | null;
}
interface MatriculaRow {
    id: string; activo: boolean; fecha_matricula: string;
    periodo_nombre: string | null; periodo_anio: number; periodo_bimestre: number | null;
    seccion: string; grado: string;
    tutor_nombre: string | null; tutor_apellido_paterno: string | null; tutor_apellido_materno: string | null;
}
interface PadreRow {
    nombre: string; apellido_paterno: string; apellido_materno: string | null;
    email: string | null; telefono: string | null; relacion: string | null;
    numero_documento: string | null; tipo_documento: string | null;
}
interface LibretaRow {
    id: string; tipo: string; nombre_archivo: string;
    periodo_nombre: string | null; periodo_anio: number; periodo_bimestre: number | null;
    observaciones: string | null; url: string | null;
}
interface NotaCursoBim { anio: number; bimestre: number; periodo_nombre: string; curso: string; color: string | null; promedio: string; cantidad: number; }
interface NotaDetalle { id: string; anio: number; bimestre: number; periodo_nombre: string; curso: string; titulo: string; tipo: string; nota: string | null; observaciones: string | null; fecha: string | null; }
interface NotaBim { anio: number; bimestre: number; periodo_nombre: string; promedio_general: string; cursos: number; }
interface AsistenciaBim { anio: number; bimestre: number; periodo_nombre: string; total: number; asistio: number; tardanza: number; justificado: number; falta: number; }
interface AsistenciaDetalle { id: string; fecha: string; estado: string; observacion: string | null; periodo_nombre: string | null; periodo_anio: number; periodo_bimestre: number | null; grado: string | null; seccion: string | null; }
interface PsicologiaResumen { asignaciones: number; fichas: number; ultima_ficha: string | null; categorias: { categoria: string; cantidad: number }[]; }
interface CitaResumen {
    total: number; pendientes: number; confirmadas: number; realizadas: number; canceladas: number;
    ultimas: { id: string; tipo: string; modalidad: string; motivo: string; estado: string; fecha_hora: string; notas_previas: string | null; notas_posteriores: string | null; }[];
}
interface ReportePayload {
    generado_en: string; anio_filtro: number | null; periodo_filtro: string | null;
    personal: PersonalData; matriculas: MatriculaRow[]; padres: PadreRow[]; libretas: LibretaRow[];
    notas: { por_curso_bimestre: NotaCursoBim[]; por_bimestre: NotaBim[]; detalle: NotaDetalle[] };
    asistencia: { total: { total: number; asistio: number; tardanza: number; justificado: number; falta: number }; por_bimestre: AsistenciaBim[]; detalle: AsistenciaDetalle[]; porcentaje_asistencia: number | null };
    psicologia: PsicologiaResumen; citas: CitaResumen;
}

@Component({
    selector: 'app-reporte-alumno',
    standalone: true,
    imports: [DatePipe, DecimalPipe, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTooltipModule, UserAvatar],
    templateUrl: './reporte-alumno.html',
    styleUrl: './reporte-alumno.scss',
})
export class ReporteAlumno {
    private api = inject(ApiService);
    private http = inject(HttpClient);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private toastr = inject(ToastService);

    loading = signal(true);
    error = signal<string | null>(null);
    data = signal<ReportePayload | null>(null);
    descargando = signal(false);
    descargandoPdf = signal(false);

    private alumnoId = '';
    private anioParam: number | undefined;
    private periodoParam: string | undefined;

    edad = computed(() => {
        const fn = this.data()?.personal?.fecha_nacimiento;
        if (!fn) return null;
        const d = new Date(fn);
        if (isNaN(d.getTime())) return null;
        const hoy = new Date();
        let e = hoy.getFullYear() - d.getFullYear();
        const m = hoy.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) e--;
        return e;
    });

    matriculaActual = computed(() => {
        const ms = this.data()?.matriculas ?? [];
        return ms.find((m) => m.activo) ?? ms[0] ?? null;
    });

    promedioGeneral = computed(() => {
        const bimestres = this.data()?.notas.por_bimestre ?? [];
        const valores = bimestres.map((b) => Number(b.promedio_general)).filter((v) => Number.isFinite(v));
        if (!valores.length) return null;
        return valores.reduce((acc, v) => acc + v, 0) / valores.length;
    });

    nombreCompleto = computed(() => {
        const p = this.data()?.personal;
        if (!p) return '';
        return [p.apellido_paterno, p.apellido_materno, p.nombre].filter(Boolean).join(' ');
    });

    // Label del filtro activo para mostrar en el header
    filtroLabel = computed(() => {
        const d = this.data();
        if (!d) return '';
        if (d.periodo_filtro) return `Período: ${d.periodo_filtro}`;
        if (d.anio_filtro) return `Año ${d.anio_filtro}`;
        return 'Histórico completo';
    });

    constructor() {
        this.route.paramMap.subscribe((p) => {
            const id = p.get('id');
            const snap = this.route.snapshot.queryParamMap;
            const anio = snap.get('anio') ?? undefined;
            const periodoId = snap.get('periodo_id') ?? undefined;
            if (id) {
                this.alumnoId = id;
                this.anioParam = anio ? parseInt(anio, 10) : undefined;
                this.periodoParam = periodoId;
                this.cargar(id, this.anioParam, periodoId);
            }
        });
    }

    private cargar(id: string, anio?: number, periodoId?: string): void {
        this.loading.set(true);
        this.error.set(null);

        const qs = new URLSearchParams();
        if (anio) qs.set('anio', String(anio));
        if (periodoId) qs.set('periodo_id', periodoId);
        const url = `admin/reports/alumno/${id}${qs.toString() ? '?' + qs.toString() : ''}`;

        this.api.get<ReportePayload>(url).subscribe({
            next: (res) => { this.data.set(res.data); this.loading.set(false); },
            error: (err) => {
                this.loading.set(false);
                const msg = err?.error?.message?.message ?? err?.error?.message ?? 'No se pudo generar el reporte';
                this.error.set(typeof msg === 'string' ? msg : 'No se pudo generar el reporte');
                this.toastr.error('Error al cargar el reporte', 'Error');
            },
        });
    }

    descargarExcel(): void {
        if (this.descargando() || !this.alumnoId) return;
        this.descargando.set(true);
        this.http.get(this.buildUrl('xlsx'), { responseType: 'blob' }).subscribe({
            next: (blob) => {
                triggerDownload(blob, `reporte_${this.nombreCompleto().replace(/\s+/g, '_') || 'alumno'}.xlsx`);
                this.descargando.set(false);
                this.toastr.success('Excel descargado correctamente', 'Éxito');
            },
            error: () => { this.descargando.set(false); this.toastr.error('No se pudo descargar el Excel', 'Error'); },
        });
    }

    descargarPdf(): void {
        if (this.descargandoPdf() || !this.alumnoId) return;
        this.descargandoPdf.set(true);
        this.http.get(this.buildUrl('pdf'), { responseType: 'blob' }).subscribe({
            next: (blob) => {
                triggerDownload(blob, `reporte_${this.nombreCompleto().replace(/\s+/g, '_') || 'alumno'}.pdf`);
                this.descargandoPdf.set(false);
                this.toastr.success('PDF descargado correctamente', 'Éxito');
            },
            error: () => { this.descargandoPdf.set(false); this.toastr.error('No se pudo descargar el PDF', 'Error'); },
        });
    }

    private buildUrl(ext: 'xlsx' | 'pdf'): string {
        const qs = new URLSearchParams();
        if (this.anioParam) qs.set('anio', String(this.anioParam));
        if (this.periodoParam) qs.set('periodo_id', this.periodoParam);
        const q = qs.toString();
        return `${environment.apiUrl}/admin/reports/alumno/${this.alumnoId}/${ext}${q ? '?' + q : ''}`;
    }

    volver(): void {
        if (history.length > 1) history.back();
        else this.router.navigate(['/admin/historico']);
    }
}

function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
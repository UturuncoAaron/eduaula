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

// Tipos del payload del backend (espejados a `AlumnoReportService.buildReport`).
interface PersonalData {
    id: string;
    codigo_estudiante: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    fecha_nacimiento: string | null;
    telefono: string | null;
    email: string | null;
    inclusivo: boolean;
    foto_url: string | null;
    foto_storage_key: string | null;
    numero_documento: string | null;
    tipo_documento: string | null;
    activo: boolean;
    anio_ingreso: number | null;
}
interface MatriculaRow {
    id: string;
    activo: boolean;
    fecha_matricula: string;
    periodo_nombre: string;
    periodo_anio: number;
    periodo_bimestre: number;
    seccion: string;
    grado: string;
    tutor_nombre: string | null;
    tutor_apellido_paterno: string | null;
    tutor_apellido_materno: string | null;
}
interface PadreRow {
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    email: string | null;
    telefono: string | null;
    relacion: string | null;
    numero_documento: string | null;
    tipo_documento: string | null;
}
interface LibretaRow {
    id: string;
    tipo: string;
    nombre_archivo: string;
    periodo_nombre: string;
    periodo_anio: number;
    periodo_bimestre: number;
    observaciones: string | null;
    url: string | null;
}
interface NotaCursoBim {
    anio: number;
    bimestre: number;
    periodo_nombre: string;
    curso: string;
    color: string | null;
    promedio: string;
    cantidad: number;
}
interface NotaDetalle {
    id: string;
    anio: number;
    bimestre: number;
    periodo_nombre: string;
    curso: string;
    titulo: string;
    tipo: string;
    nota: string | null;
    observaciones: string | null;
    fecha: string | null;
}
interface NotaBim {
    anio: number;
    bimestre: number;
    periodo_nombre: string;
    promedio_general: string;
    cursos: number;
}
interface AsistenciaBim {
    anio: number;
    bimestre: number;
    periodo_nombre: string;
    total: number;
    asistio: number;
    tardanza: number;
    justificado: number;
    falta: number;
}
interface AsistenciaDetalle {
    id: string;
    fecha: string;
    estado: string;
    observacion: string | null;
    periodo_nombre: string;
    periodo_anio: number;
    periodo_bimestre: number;
    grado: string | null;
    seccion: string | null;
}
interface PsicologiaResumen {
    asignaciones: number;
    fichas: number;
    ultima_ficha: string | null;
    categorias: { categoria: string; cantidad: number }[];
}
interface CitaResumen {
    total: number;
    pendientes: number;
    confirmadas: number;
    realizadas: number;
    canceladas: number;
    ultimas: {
        id: string;
        tipo: string;
        modalidad: string;
        motivo: string;
        estado: string;
        fecha_hora: string;
        notas_previas: string | null;
        notas_posteriores: string | null;
    }[];
}
interface ReportePayload {
    generado_en: string;
    anio_filtro: number | null;
    personal: PersonalData;
    matriculas: MatriculaRow[];
    padres: PadreRow[];
    libretas: LibretaRow[];
    notas: {
        por_curso_bimestre: NotaCursoBim[];
        por_bimestre: NotaBim[];
        detalle: NotaDetalle[];
    };
    asistencia: {
        total: { total: number; asistio: number; tardanza: number; justificado: number; falta: number };
        por_bimestre: AsistenciaBim[];
        detalle: AsistenciaDetalle[];
        porcentaje_asistencia: number | null;
    };
    psicologia: PsicologiaResumen;
    citas: CitaResumen;
}

@Component({
    selector: 'app-reporte-alumno',
    standalone: true,
    imports: [
        DatePipe, DecimalPipe,
        MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTooltipModule,
        UserAvatar
    ],
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

    /** ID del alumno actual (para construir la URL de descarga). */
    private alumnoId = '';
    private anioParam: number | undefined;

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
        const valores = bimestres
            .map((b) => Number(b.promedio_general))
            .filter((v) => Number.isFinite(v));
        if (!valores.length) return null;
        return valores.reduce((acc, v) => acc + v, 0) / valores.length;
    });

    nombreCompleto = computed(() => {
        const p = this.data()?.personal;
        if (!p) return '';
        return [
            p.apellido_paterno,
            p.apellido_materno,
            p.nombre,
        ].filter(Boolean).join(' ');
    });

    constructor() {
        this.route.paramMap.subscribe((p) => {
            const id = p.get('id');
            const anio = this.route.snapshot.queryParamMap.get('anio') ?? undefined;
            if (id) {
                this.alumnoId = id;
                this.anioParam = anio ? parseInt(anio, 10) : undefined;
                this.cargar(id, this.anioParam);
            }
        });
    }

    private cargar(id: string, anio?: number): void {
        this.loading.set(true);
        this.error.set(null);

        const url = anio
            ? `admin/reports/alumno/${id}?anio=${anio}`
            : `admin/reports/alumno/${id}`;

        this.api.get<ReportePayload>(url).subscribe({
            next: (res) => {
                this.data.set(res.data);
                this.loading.set(false);
            },
            error: (err) => {
                this.loading.set(false);
                const msg = err?.error?.message?.message
                    ?? err?.error?.message
                    ?? 'No se pudo generar el reporte';
                this.error.set(typeof msg === 'string' ? msg : 'No se pudo generar el reporte');
                this.toastr.error('Error al cargar el reporte', 'Error');
            },
        });
    }

    /** Descarga el reporte en formato Excel (.xlsx) desde el backend. */
    descargarExcel(): void {
        if (this.descargando() || !this.alumnoId) return;
        this.descargando.set(true);

        let url = `${environment.apiUrl}/admin/reports/alumno/${this.alumnoId}/xlsx`;
        if (this.anioParam) url += `?anio=${this.anioParam}`;

        this.http
            .get(url, { responseType: 'blob' })
            .subscribe({
                next: (blob) => {
                    const nombre = this.nombreCompleto().replace(/\s+/g, '_') || 'alumno';
                    const filename = `reporte_${nombre}.xlsx`;
                    triggerDownload(blob, filename);
                    this.descargando.set(false);
                    this.toastr.success('Excel descargado correctamente', 'Éxito');
                },
                error: () => {
                    this.descargando.set(false);
                    this.toastr.error('No se pudo descargar el Excel', 'Error');
                },
            });
    }

    volver(): void {
        // Vuelve a la página previa si existe, si no a la lista de alumnos.
        if (history.length > 1) history.back();
        else this.router.navigate(['/admin/usuarios/alumnos']);
    }
}

/** Dispara la descarga de un blob como archivo. */
function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

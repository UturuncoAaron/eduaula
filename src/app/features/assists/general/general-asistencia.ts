import {
    Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

type EstadoAsistencia = 'asistio' | 'falta' | 'tardanza' | 'justificado';

interface AlumnoRow {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string;
    codigo_estudiante: string;
    foto_url: string | null;
    estado: EstadoAsistencia;
}

const AVATAR_COLORS = [
    '#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b',
    '#ef4444', '#10b981', '#06b6d4', '#ec4899',
];

const MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DIAS = [
    'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
];

@Component({
    selector: 'app-general-asistencia',
    standalone: true,
    imports: [MatIconModule],
    templateUrl: './general-asistencia.html',
    styleUrl: './general-asistencia.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralAsistencia implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private api = inject(ApiService);
    private toastr = inject(ToastService);

    seccionId = '';
    readonly today = new Date();
    readonly todayStr = this.today.toISOString().slice(0, 10);
    readonly fechaLabel = `${DIAS[this.today.getDay()]}, ${this.today.getDate()} de ${MESES[this.today.getMonth()]} de ${this.today.getFullYear()}`;

    loading = signal(true);
    saving = signal(false);
    error = signal<string | null>(null);
    seccionNombre = signal('');
    gradoNombre = signal('');
    alumnos = signal<AlumnoRow[]>([]);

    readonly totalPresentes = computed(() => this.alumnos().filter(a => a.estado === 'asistio').length);
    readonly totalFaltas = computed(() => this.alumnos().filter(a => a.estado === 'falta').length);
    readonly totalTardanzas = computed(() => this.alumnos().filter(a => a.estado === 'tardanza').length);
    readonly totalJustificados = computed(() => this.alumnos().filter(a => a.estado === 'justificado').length);
    readonly pctAsistencia = computed(() => {
        const t = this.alumnos().length;
        if (!t) return 0;
        return Math.round(
            ((this.totalPresentes() + this.totalTardanzas() + this.totalJustificados()) / t) * 100,
        );
    });

    ngOnInit() {
        this.seccionId = this.route.snapshot.paramMap.get('seccionId') ?? '';
        this.loadData();
    }

    loadData() {
        this.loading.set(true);
        this.error.set(null);

        forkJoin({
            alumnos: this.api.get<any>(`admin/users/alumnos?seccion_id=${this.seccionId}&limit=100`),
            asistencias: this.api.get<any>(
                `asistencias/general/${this.seccionId}?fecha=${this.todayStr}`,
            ).pipe(catchError(() => of({ data: [] }))),
        }).subscribe({
            next: ({ alumnos, asistencias }) => {
                const lista: any[] = alumnos?.data?.data ?? alumnos?.data ?? [];
                const asist: any[] = Array.isArray(asistencias?.data)
                    ? asistencias.data
                    : Array.isArray(asistencias) ? asistencias : [];

                const map = new Map<string, EstadoAsistencia>(
                    asist.map((a: any) => [a.alumno_id, a.estado as EstadoAsistencia]),
                );

                if (lista.length) {
                    this.gradoNombre.set(lista[0].grado ?? '');
                    this.seccionNombre.set(lista[0].seccion ?? '');
                }

                this.alumnos.set(lista.map((a: any): AlumnoRow => ({
                    id: a.id,
                    nombre: a.nombre,
                    apellido_paterno: a.apellido_paterno,
                    apellido_materno: a.apellido_materno ?? '',
                    codigo_estudiante: a.codigo_estudiante,
                    foto_url: a.foto_url ?? null,
                    estado: map.get(a.id) ?? 'asistio',
                })));

                this.loading.set(false);
            },
            error: () => {
                this.error.set('No se pudo cargar la sección. Verifica tu conexión.');
                this.loading.set(false);
            },
        });
    }

    marcarTodos(estado: EstadoAsistencia) {
        this.alumnos.update(list => list.map(a => ({ ...a, estado })));
    }

    setEstado(id: string, estado: EstadoAsistencia) {
        this.alumnos.update(list =>
            list.map(a => a.id === id ? { ...a, estado } : a),
        );
    }

    getAvatarColor(nombre: string): string {
        let h = 0;
        for (const c of nombre) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
        return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
    }

    initials(a: AlumnoRow): string {
        return `${a.nombre.charAt(0)}${a.apellido_paterno.charAt(0)}`.toUpperCase();
    }

    guardar() {
        if (this.saving() || !this.alumnos().length) return;
        this.saving.set(true);

        this.api.post(`asistencias/general/${this.seccionId}/bulk`, {
            fecha: this.todayStr,
            alumnos: this.alumnos().map(a => ({ alumno_id: a.id, estado: a.estado })),
        }).subscribe({
            next: () => {
                this.toastr.success('Asistencia guardada correctamente ✓');
                this.router.navigate(['/dashboard']);
            },
            error: (err: any) => {
                this.toastr.error(err?.error?.message ?? 'Error al guardar la asistencia');
                this.saving.set(false);
            },
        });
    }

    volver() { this.router.navigate(['/dashboard']); }
}
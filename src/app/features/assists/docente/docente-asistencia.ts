import {
    Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

type EstadoDocente = 'presente' | 'tardanza' | 'ausente' | 'permiso' | 'licencia';

interface HorarioDocente {
    horarioId: string;
    docenteId: string;
    nombre: string;
    apellidoPaterno: string;
    especialidad: string;
    cursoNombre: string;
    horaInicio: string;
    horaFin: string;
    aula: string;
    estado: EstadoDocente;
}

const AVATAR_COLORS = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

@Component({
    selector: 'app-docente-asistencia',
    standalone: true,
    imports: [MatIconModule],
    templateUrl: './docente-asistencia.html',
    styleUrl: './docente-asistencia.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocenteAsistencia implements OnInit {
    private router = inject(Router);
    private api = inject(ApiService);
    private toastr = inject(ToastService);

    // ── Fecha seleccionada (editable) ──────────────────────────
    readonly todayStr = new Date().toISOString().slice(0, 10);
    selectedDate = signal<string>(this.todayStr);

    readonly diaSemana = computed(() => {
        const d = new Date(this.selectedDate() + 'T00:00:00');
        return DIAS[d.getDay()];
    });

    readonly fechaLabel = computed(() => {
        const d = new Date(this.selectedDate() + 'T00:00:00');
        return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
    });

    readonly isToday = computed(() => this.selectedDate() === this.todayStr);
    readonly isFuture = computed(() => this.selectedDate() > this.todayStr);

    // ── Estado ─────────────────────────────────────────────────
    loading = signal(true);
    saving = signal(false);
    error = signal<string | null>(null);
    horarios = signal<HorarioDocente[]>([]);

    readonly totalPresentes = computed(() => this.horarios().filter(h => h.estado === 'presente').length);
    readonly totalAusentes = computed(() => this.horarios().filter(h => h.estado === 'ausente').length);
    readonly totalTardanzas = computed(() => this.horarios().filter(h => h.estado === 'tardanza').length);

    ngOnInit() { this.loadHorarios(); }

    // ── Cambia la fecha y recarga ──────────────────────────────
    onDateChange(value: string) {
        if (!value) return;
        if (value > this.todayStr) {
            this.toastr.warning('No puedes registrar asistencia de fechas futuras');
            return;
        }
        this.selectedDate.set(value);
        this.loadHorarios();
    }

    loadHorarios() {
        this.loading.set(true);
        this.error.set(null);

        const dia = this.diaSemana();
        const fecha = this.selectedDate();

        // Carga horarios del día + registros existentes para esa fecha en paralelo
        forkJoin({
            horarios: this.api.get<any>(`horarios/hoy?dia=${dia}`),
            existentes: this.api.get<any>(`asistencias/docente/horarios-dia?fecha=${fecha}`)
                .pipe(catchError(() => of({ data: [] }))),
        }).subscribe({
            next: ({ horarios, existentes }) => {
                const lista: any[] = horarios?.data ?? horarios ?? [];

                // Construye un mapa horario_id → estado a partir de registros existentes
                const existList: any[] = existentes?.data ?? existentes ?? [];
                const estadoMap = new Map<string, EstadoDocente>(
                    existList.map((e: any) => [
                        e.horario_id ?? e.horarioId,
                        e.estado as EstadoDocente,
                    ]),
                );

                this.horarios.set(lista.map((h: any): HorarioDocente => ({
                    horarioId: h.id ?? h.horario_id,
                    docenteId: h.docente_id,
                    nombre: h.docente_nombre ?? h.nombre ?? '',
                    apellidoPaterno: h.docente_apellido_paterno ?? h.apellido_paterno ?? '',
                    especialidad: h.especialidad ?? '',
                    cursoNombre: h.curso_nombre ?? '',
                    horaInicio: h.hora_inicio,
                    horaFin: h.hora_fin,
                    aula: h.aula ?? '',
                    // Si ya existe un registro para esa fecha, lo usa; si no, 'presente'
                    estado: estadoMap.get(h.id ?? h.horario_id) ?? 'presente',
                })));

                this.loading.set(false);
            },
            error: () => {
                this.error.set('No se pudieron cargar los horarios del día.');
                this.loading.set(false);
            },
        });
    }

    setEstado(horarioId: string, estado: EstadoDocente) {
        this.horarios.update(list =>
            list.map(h => h.horarioId === horarioId ? { ...h, estado } : h),
        );
    }

    marcarTodos(estado: EstadoDocente) {
        this.horarios.update(list => list.map(h => ({ ...h, estado })));
    }

    getAvatarColor(nombre: string): string {
        let hash = 0;
        for (const c of nombre) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
        return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
    }

    initials(h: HorarioDocente): string {
        return `${h.nombre.charAt(0)}${h.apellidoPaterno.charAt(0)}`.toUpperCase();
    }

    guardar() {
        if (this.saving() || !this.horarios().length) return;
        this.saving.set(true);

        this.api.post('asistencias/docente/bulk', {
            fecha: this.selectedDate(),
            registros: this.horarios().map(h => ({
                horario_id: h.horarioId,
                docente_id: h.docenteId,
                estado: h.estado,
            })),
        }).subscribe({
            next: () => {
                const msg = this.isToday()
                    ? 'Asistencia de docentes guardada ✓'
                    : `Registro del ${this.selectedDate()} actualizado ✓`;
                this.toastr.success(msg);
                this.router.navigate(['/dashboard']);
            },
            error: (err: any) => {
                this.toastr.error(err?.error?.message ?? 'Error al guardar');
                this.saving.set(false);
            },
        });
    }

    volver() { this.router.navigate(['/dashboard']); }
}
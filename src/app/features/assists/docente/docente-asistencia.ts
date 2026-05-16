import {
    Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';

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

    readonly today = new Date();
    readonly todayStr = this.today.toISOString().slice(0, 10);
    readonly diaSemana = DIAS[this.today.getDay()];
    readonly fechaLabel = `${this.diaSemana}, ${this.today.getDate()} de ${MESES[this.today.getMonth()]} de ${this.today.getFullYear()}`;

    loading = signal(true);
    saving = signal(false);
    error = signal<string | null>(null);
    horarios = signal<HorarioDocente[]>([]);

    readonly totalPresentes = computed(() => this.horarios().filter(h => h.estado === 'presente').length);
    readonly totalAusentes = computed(() => this.horarios().filter(h => h.estado === 'ausente').length);
    readonly totalTardanzas = computed(() => this.horarios().filter(h => h.estado === 'tardanza').length);

    ngOnInit() { this.loadHorarios(); }

    loadHorarios() {
        this.loading.set(true);
        this.error.set(null);

        // Endpoint: GET /horarios/hoy?dia=lunes
        // Devuelve los horarios del día con docente_id, docente info, curso info
        this.api.get<any>(`horarios/hoy?dia=${this.diaSemana}`).subscribe({
            next: (r: any) => {
                const lista: any[] = r?.data ?? r ?? [];
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
                    estado: 'presente',
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

        // Endpoint: POST /asistencias/docente/bulk
        this.api.post('asistencias/docente/bulk', {
            fecha: this.todayStr,
            registros: this.horarios().map(h => ({
                horario_id: h.horarioId,
                docente_id: h.docenteId,
                estado: h.estado,
            })),
        }).subscribe({
            next: () => {
                this.toastr.success('Asistencia de docentes guardada ✓');
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
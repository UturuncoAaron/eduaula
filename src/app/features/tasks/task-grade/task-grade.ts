import {
  Component, inject, signal, computed,
  OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { TaskService } from '../data-access/task.store';
import { Submission } from '../../../core/models/task';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

export interface AlumnoRow {
  alumno_id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  codigo_estudiante: string;
  foto_storage_key: string | null;
  submission: Submission | null;
}

type EstadoEntrega = 'sin_entregar' | 'a_tiempo' | 'con_retraso' | 'calificada';

function estadoDeEntrega(s: Submission | null): EstadoEntrega {
  if (!s) return 'sin_entregar';
  if (s.calificacion_final != null) return 'calificada';
  return s.con_retraso ? 'con_retraso' : 'a_tiempo';
}

@Component({
  selector: 'app-task-grade',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
   MatCardModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatFormFieldModule, MatInputModule,
  PageHeader, EmptyState,
  ],
  templateUrl: './task-grade.html',
  styleUrl: './task-grade.scss',
})
export class TaskGrade implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private api = inject(ApiService);
  private taskSvc = inject(TaskService);
  private toastr = inject(ToastService);

  taskId = this.route.snapshot.paramMap.get('id')!;
  taskTitulo = signal<string>('');
  loading = signal(true);
  alumnos = signal<AlumnoRow[]>([]);

  // ── Filtro de búsqueda ───────────────────────────────────────
  filtro = signal('');

  alumnosFiltrados = computed(() => {
    const q = this.filtro().toLowerCase().trim();
    if (!q) return this.alumnos();
    return this.alumnos().filter(a =>
      `${a.apellido_paterno} ${a.apellido_materno ?? ''} ${a.nombre} ${a.codigo_estudiante}`
        .toLowerCase().includes(q),
    );
  });

  // ── Contadores para el resumen ───────────────────────────────
  totalEntregados = computed(() =>
    this.alumnos().filter(a => a.submission !== null).length,
  );
  totalCalificados = computed(() =>
    this.alumnos().filter(a => a.submission?.calificacion_final != null).length,
  );

  estadoDeEntrega = estadoDeEntrega;

  ngOnInit() {
    // 1. Traer la tarea para obtener curso_id y título
    this.taskSvc.getTask(this.taskId).pipe(
      switchMap(tareaRes => {
        const tarea = tareaRes.data;
        this.taskTitulo.set(tarea.titulo);
        // 2. Traer el curso para obtener seccion_id
        return this.api.get<{ id: string; seccion_id: string; nombre?: string }>(
          `courses/${tarea.curso_id}`,
        ).pipe(
          switchMap(cursoRes => {
            const seccionId = cursoRes.data.seccion_id;
            // 3. Traer alumnos de la sección + entregas en paralelo
            return forkJoin({
              alumnos: this.api.get<any[]>(`courses/seccion/${seccionId}/students`),
              submissions: this.taskSvc.getSubmissions(this.taskId),
            });
          }),
        );
      }),
    ).subscribe({
      next: ({ alumnos, submissions }) => {
        const subMap = new Map<string, Submission>(
          (submissions.data as Submission[]).map(s => [s.alumno_id, s]),
        );

        // getEnrollmentsBySeccion devuelve alumno_id separado del id de matrícula
        const rows: AlumnoRow[] = (alumnos.data as any[]).map(a => ({
          alumno_id: a.alumno_id,
          nombre: a.nombre,
          apellido_paterno: a.apellido_paterno,
          apellido_materno: a.apellido_materno ?? null,
          codigo_estudiante: a.codigo_estudiante ?? '',
          foto_storage_key: a.foto_storage_key ?? null,
          submission: subMap.get(a.alumno_id) ?? null,
        }));

        // Ordenar: con entrega primero, luego sin entregar; dentro de cada grupo por apellido
        rows.sort((a, b) => {
          const aTieneEntrega = a.submission !== null ? 0 : 1;
          const bTieneEntrega = b.submission !== null ? 0 : 1;
          if (aTieneEntrega !== bTieneEntrega) return aTieneEntrega - bTieneEntrega;
          return a.apellido_paterno.localeCompare(b.apellido_paterno);
        });

        this.alumnos.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('No se pudo cargar la lista de alumnos', 'Error');
        this.loading.set(false);
      },
    });
  }

  goBack() { this.location.back(); }

  verDetalle(alumno: AlumnoRow) {
    this.router.navigate([`/tareas/${this.taskId}/calificar/${alumno.alumno_id}`]);
  }

  nombreCompleto(a: AlumnoRow): string {
    return `${a.apellido_paterno}${a.apellido_materno ? ' ' + a.apellido_materno : ''}, ${a.nombre}`;
  }

  onFiltro(ev: Event) {
    this.filtro.set((ev.target as HTMLInputElement).value);
  }
}
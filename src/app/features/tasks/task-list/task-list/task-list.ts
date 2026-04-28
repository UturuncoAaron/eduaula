import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';
import { Course } from '../../../../core/models/course';
import { Task, Submission } from '../../../../core/models/task';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { LoadingSkeleton } from '../../../../shared/components/loading-skeleton/loading-skeleton';
import { TaskSubmissionsPane } from '../../task-submissions-pane/task-submissions-pane';
import { MySubmissionView } from '../../my-submission-view/my-submission-view';

type EstadoAlumno = 'pendiente' | 'vencida' | 'entregada' | 'calificada';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [
    MatCardModule, MatIconModule, MatButtonModule, MatChipsModule,
    DatePipe, RouterLink, PageHeader, EmptyState, LoadingSkeleton,
  ],
  templateUrl: './task-list.html',
  styleUrl: './task-list.scss',
})
export class TaskList implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  tasks = signal<Task[]>([]);
  submissionByTask = signal<Record<string, Submission>>({});
  loading = signal(true);

  hasData = computed(() => this.tasks().length > 0);

  ngOnInit() {
    this.api.get<Course[]>('courses').subscribe({
      next: r => this.cargar(r.data),
      error: () => { this.tasks.set([]); this.loading.set(false); },
    });
  }

  private cargar(cursos: Course[]) {
    if (!cursos.length) { this.tasks.set([]); this.loading.set(false); return; }

    const taskReqs = cursos.map(c =>
      this.api.get<Task[]>(`courses/${c.id}/tasks`).pipe(
        map(r => r.data.map(t => ({ ...t, curso_id: c.id, curso: c.nombre }))),
        catchError(() => of([] as Task[])),
      ),
    );
    const mine$ = this.auth.isAlumno()
      ? this.api.get<Submission[]>('my-submissions').pipe(
        map(r => r.data ?? []),
        catchError(() => of([] as Submission[])),
      )
      : of([] as Submission[]);

    forkJoin({ lists: forkJoin(taskReqs), mine: mine$ }).subscribe(({ lists, mine }) => {
      const flat = lists.flat();
      const byId = new Map<string, Task>();
      for (const t of flat) if (!byId.has(t.id)) byId.set(t.id, t);
      this.tasks.set([...byId.values()]);
      const byTask: Record<string, Submission> = {};
      for (const s of mine) byTask[s.tarea_id] = s;
      this.submissionByTask.set(byTask);
      this.loading.set(false);
    });
  }

  miEntrega(t: Task): Submission | undefined {
    return this.submissionByTask()[t.id];
  }

  isPending(t: Task): boolean {
    return new Date(t.fecha_limite) > new Date();
  }

  estadoAlumno(t: Task): EstadoAlumno {
    const s = this.miEntrega(t);
    if (s) return s.calificacion_final != null ? 'calificada' : 'entregada';
    return this.isPending(t) ? 'pendiente' : 'vencida';
  }

  estadoLabel(t: Task): string {
    switch (this.estadoAlumno(t)) {
      case 'calificada': {
        const s = this.miEntrega(t)!;
        return `Calificada ${s.calificacion_final}/${t.puntos_max}`;
      }
      case 'entregada': return 'Entregada';
      case 'pendiente': return 'Pendiente';
      case 'vencida': return 'Vencida';
    }
  }

  abrirEntregas(t: Task) {
    this.dialog.open(TaskSubmissionsPane, {
      data: { task: t },
      width: '92vw',
      maxWidth: '100vw',
      height: '100vh',
      maxHeight: '100vh',
      position: { right: '0', top: '0' },
      panelClass: 'material-preview-pane',
      enterAnimationDuration: 0,
      exitAnimationDuration: 0,
    });
  }

  abrirMiEntrega(t: Task) {
    this.dialog.open(MySubmissionView, {
      data: { task: t, submission: this.miEntrega(t) ?? null },
      width: '92vw',
      maxWidth: '100vw',
      height: '100vh',
      maxHeight: '100vh',
      position: { right: '0', top: '0' },
      panelClass: 'material-preview-pane',
      enterAnimationDuration: 0,
      exitAnimationDuration: 0,
    });
  }
}

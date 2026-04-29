import { Component, inject, input, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../../../../core/services/api';
import { AuthService } from '../../../../../core/auth/auth';
import { Task, Submission, tipoEntregaTarea, estadoAlumno as calcEstadoAlumno, EstadoTarea } from '../../../../../core/models/task';

@Component({
  selector: 'app-tab-tareas',
  standalone: true,
  imports: [DatePipe, RouterLink, MatIconModule, MatButtonModule, MatChipsModule],
  templateUrl: './tab-tareas.html',
  styleUrl: './tab-tareas.scss',
})
export class TabTareas implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  courseId = input.required<string>();

  tasks = signal<Task[]>([]);
  submissionByTask = signal<Record<string, Submission>>({});
  loading = signal(true);

  ngOnInit() { this.loadTasks(); }

  loadTasks() {
    this.loading.set(true);
    this.api.get<Task[]>(`courses/${this.courseId()}/tasks`).subscribe({
      next: res => {
        const byId = new Map<string, Task>();
        for (const t of (res.data ?? [])) if (!byId.has(t.id)) byId.set(t.id, t);
        this.tasks.set([...byId.values()]);
        this.loading.set(false);
        if (this.auth.isAlumno()) this.loadMySubmissions();
      },
      error: () => { this.tasks.set([]); this.loading.set(false); },
    });
  }

  private loadMySubmissions() {
    this.api.get<Submission[]>('my-submissions').subscribe({
      next: res => {
        const map: Record<string, Submission> = {};
        for (const s of (res.data ?? [])) map[s.tarea_id] = s;
        this.submissionByTask.set(map);
      },
      error: () => this.submissionByTask.set({}),
    });
  }

  miEntrega(t: Task): Submission | undefined {
    return this.submissionByTask()[t.id];
  }

  isInteractiva(t: Task): boolean {
    return tipoEntregaTarea(t) === 'interactiva';
  }

  estadoAlumno(t: Task): EstadoTarea {
    return calcEstadoAlumno(t, this.miEntrega(t));
  }

  estadoLabel(t: Task): string {
    switch (this.estadoAlumno(t)) {
      case 'calificada': return `Calificada ${this.miEntrega(t)!.calificacion_final}/${t.puntos_max}`;
      case 'entregada': return 'Entregada';
      case 'pendiente': return 'Pendiente';
      case 'vencida': return 'Vencida';
    }
  }

  isPending(fecha: string): boolean { return new Date(fecha) > new Date(); }

  async abrirEntregasDocente(t: Task) {
    const { TaskSubmissionsPane } = await import(
      '../../../../tasks/task-submissions-pane/task-submissions-pane'
    );
    this.dialog.open(TaskSubmissionsPane, {
      data: { task: t },
      width: '92vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh',
      position: { right: '0', top: '0' },
      panelClass: 'material-preview-pane',
      enterAnimationDuration: 0, exitAnimationDuration: 0,
    });
  }

  async abrirMiEntrega(t: Task) {
    const { MySubmissionView } = await import(
      '../../../../tasks/my-submission-view/my-submission-view'
    );
    const ref = this.dialog.open(MySubmissionView, {
      data: { task: t, submission: this.miEntrega(t) ?? null },
      width: '92vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh',
      position: { right: '0', top: '0' },
      panelClass: 'material-preview-pane',
      enterAnimationDuration: 0, exitAnimationDuration: 0,
    });
    ref.afterClosed().subscribe(() => this.loadMySubmissions());
  }

  async openCreateTask() {
    const { TaskCreate } = await import(
      '../../../../tasks/task-create/task-create'
    );
    const ref = this.dialog.open(TaskCreate, { data: this.courseId(), width: '600px' });
    ref.afterClosed().subscribe(r => { if (r) this.loadTasks(); });
  }
}
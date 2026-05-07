import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';
import { CourseService } from '../data-access/course.store';
import { TaskService } from '../../tasks/data-access/task.store';
import { Material, SemanaResumen } from '../../../core/models/course';
import { Task } from '../../../core/models/task';
import { Forum } from '../../../core/models/forum';
import { formDrawerConfig } from '../../../shared/utils/form-drawer';

export interface SemanaPaneData {
  courseId: string;
  semana: SemanaResumen;
}

@Component({
  selector: 'app-semana-pane',
  standalone: true,
  imports: [
    DatePipe, UpperCasePipe,
    MatIconModule, MatButtonModule, MatTabsModule,
    MatDialogModule, MatSlideToggleModule, MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './semana-pane.html',
  styleUrl: './semana-pane.scss',
})
export class SemanaPane implements OnInit {
  readonly auth = inject(AuthService);
  private csSvc = inject(CourseService);
  private taskSvc = inject(TaskService);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private dialogRef = inject(MatDialogRef<SemanaPane>);
  private toastr = inject(ToastService);
  private router = inject(Router);
  readonly data = inject<SemanaPaneData>(MAT_DIALOG_DATA);

  readonly courseId = this.data.courseId;
  semana = signal<SemanaResumen>(this.data.semana);

  materials = signal<Material[]>([]);
  tasks = signal<Task[]>([]);
  forums = signal<Forum[]>([]);

  loadingMaterials = signal(true);
  loadingTasks = signal(true);
  loadingForums = signal(true);

  /** True si el docente cambió algo y el padre debería refrescar. */
  private touched = false;

  readonly materialIcons: Record<string, string> = {
    pdf: 'picture_as_pdf', video: 'smart_display',
    link: 'link', grabacion: 'videocam', otro: 'attach_file',
  };
  readonly materialColors: Record<string, string> = {
    pdf: '#dc2626', video: '#2563eb',
    link: '#16a34a', grabacion: '#9333ea', otro: '#4b5563',
  };

  materialesSemana = computed(
    () => this.materials().filter((m) => (m.semana ?? null) === this.semana().semana),
  );
  tareasSemana = computed(
    () => this.tasks().filter((t) => (t.semana ?? null) === this.semana().semana),
  );
  forosSemana = computed(
    () => this.forums().filter((f) => (f.semana ?? null) === this.semana().semana),
  );

  ngOnInit(): void {
    this.loadMaterials();
    this.loadTasks();
    this.loadForums();
  }

  private loadMaterials(): void {
    this.loadingMaterials.set(true);
    this.csSvc.getMaterials(this.courseId).subscribe({
      next: (r) => { this.materials.set(r.data ?? []); this.loadingMaterials.set(false); },
      error: () => { this.materials.set([]); this.loadingMaterials.set(false); },
    });
  }

  private loadTasks(): void {
    this.loadingTasks.set(true);
    this.taskSvc.getTasks(this.courseId).subscribe({
      next: (r) => { this.tasks.set(r.data ?? []); this.loadingTasks.set(false); },
      error: () => { this.tasks.set([]); this.loadingTasks.set(false); },
    });
  }

  private loadForums(): void {
    this.loadingForums.set(true);
    this.api.get<Forum[]>(`courses/${this.courseId}/forums`).subscribe({
      next: (r) => { this.forums.set(r.data ?? []); this.loadingForums.set(false); },
      error: () => { this.forums.set([]); this.loadingForums.set(false); },
    });
  }

  cerrar(): void {
    this.dialogRef.close(this.touched);
  }

  // ── Toggle de la semana completa ───────────────────────────
  toggleSemana(oculta: boolean): void {
    const numero = this.semana().semana;
    this.csSvc.toggleSemana(this.courseId, numero, oculta).subscribe({
      next: (r) => {
        this.semana.set(r.data);
        this.touched = true;
        this.toastr.success(oculta ? 'Semana oculta para los alumnos' : 'Semana visible', '�xito');
      },
      error: () => this.toastr.error('No se pudo actualizar la semana', 'Error'),
    });
  }

  // ── Toggles por ítem ───────────────────────────────────────
  toggleMaterial(m: Material): void {
    const oculto = !(m.oculto ?? false);
    this.csSvc.toggleMaterial(this.courseId, m.id, oculto).subscribe({
      next: () => {
        this.materials.update((list) => list.map((x) => x.id === m.id ? { ...x, oculto } : x));
        this.touched = true;
      },
      error: () => this.toastr.error('No se pudo actualizar el material', 'Error'),
    });
  }

  toggleTask(t: Task): void {
    const activo = !t.activo;
    this.taskSvc.toggleTask(t.id, activo).subscribe({
      next: () => {
        this.tasks.update((list) => list.map((x) => x.id === t.id ? { ...x, activo } : x));
        this.touched = true;
      },
      error: () => this.toastr.error('No se pudo actualizar la tarea', 'Error'),
    });
  }

  toggleForum(f: Forum): void {
    const oculto = !(f.oculto ?? false);
    this.csSvc.toggleForum(this.courseId, f.id, oculto).subscribe({
      next: () => {
        this.forums.update((list) => list.map((x) => x.id === f.id ? { ...x, oculto } : x));
        this.touched = true;
      },
      error: () => this.toastr.error('No se pudo actualizar el foro', 'Error'),
    });
  }

  // ── Crear desde la semana ──────────────────────────────────
  // Drawer lateral derecho (formDrawerConfig) — mismo patrón visual que
  // MaterialPreview, para que el flujo sea consistente.
  async crearMaterial(): Promise<void> {
    const { MaterialUpload } = await import(
      '../material-upload/material-upload'
    );
    const ref = this.dialog.open(
      MaterialUpload,
      formDrawerConfig(
        {
          courseId: this.courseId,
          bimestre: this.semana().bimestre,
          semana: this.semana().semana,
        },
        'md',
      ),
    );
    ref.afterClosed().subscribe((r) => { if (r) { this.touched = true; this.loadMaterials(); } });
  }

  async crearTarea(): Promise<void> {
    const { TaskCreate } = await import(
      '../../tasks/task-create/task-create'
    );
    const ref = this.dialog.open(
      TaskCreate,
      formDrawerConfig(
        {
          courseId: this.courseId,
          bimestre: this.semana().bimestre,
          semana: this.semana().semana,
        },
        'lg',
      ),
    );
    ref.afterClosed().subscribe((r) => { if (r) { this.touched = true; this.loadTasks(); } });
  }

  async crearForo(): Promise<void> {
    const { ForumCreate } = await import(
      '../../forum/forum-create/forum-create'
    );
    const ref = this.dialog.open(
      ForumCreate,
      formDrawerConfig(
        {
          courseId: this.courseId,
          bimestre: this.semana().bimestre,
          semana: this.semana().semana,
        },
        'md',
      ),
    );
    ref.afterClosed().subscribe((r) => { if (r) { this.touched = true; this.loadForums(); } });
  }

  // ── Navegación / acciones ──────────────────────────────────
  async abrirMaterial(m: Material): Promise<void> {
    const { MaterialPreview } = await import(
      '../material-preview/material-preview'
    );
    this.dialog.open(MaterialPreview, {
      data: { courseId: this.courseId, material: m },
      width: '92vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh',
      position: { right: '0', top: '0' },
      panelClass: 'material-preview-pane',
      enterAnimationDuration: 0, exitAnimationDuration: 0,
    });
  }

  abrirForo(f: Forum): void {
    this.dialogRef.close(this.touched);
    this.router.navigate(['/foro', f.id]);
  }

  abrirTarea(t: Task): void {
    this.dialogRef.close(this.touched);
    if (this.auth.isAlumno()) {
      this.router.navigate(t.permite_alternativas ? ['/tareas', t.id, 'tomar'] : ['/tareas', t.id, 'entregar']);
    } else {
      this.router.navigate(['/tareas', t.id, 'entregas']);
    }
  }

  formatSize(bytes?: number | null): string {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }
}

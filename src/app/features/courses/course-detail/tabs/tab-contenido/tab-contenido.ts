import { Component, inject, input, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from 'ngx-toastr-notifier';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../../../core/auth/auth';
import { ApiService } from '../../../../../core/services/api';
import { CourseService } from '../../../stores/course';
import { TaskService } from '../../../../tasks/stores/task';
import { Course, LiveClass, Material, SemanaResumen } from '../../../../../core/models/course';
import { Task } from '../../../../../core/models/task';
import { Forum } from '../../../../../core/models/forum';

type ItemKind = 'material' | 'tarea' | 'foro';

interface SemanaItem {
  kind: ItemKind;
  id: string;
  titulo: string;
  descripcion: string | null;
  oculto: boolean;
  fecha: string;
  raw: Material | Task | Forum;
}

@Component({
  selector: 'app-tab-contenido',
  standalone: true,
  imports: [
    DatePipe, RouterLink,
    MatIconModule, MatButtonModule, MatExpansionModule,
    MatProgressSpinnerModule, MatMenuModule, MatTooltipModule,
  ],
  templateUrl: './tab-contenido.html',
  styleUrl: './tab-contenido.scss',
})
export class TabContenido implements OnInit {
  readonly auth = inject(AuthService);
  private csSvc = inject(CourseService);
  private taskSvc = inject(TaskService);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  private router = inject(Router);

  courseId = input.required<string>();
  course = input<Course | null>(null);

  semanas = signal<SemanaResumen[]>([]);
  liveClasses = signal<LiveClass[]>([]);
  materials = signal<Material[]>([]);
  tasks = signal<Task[]>([]);
  forums = signal<Forum[]>([]);

  loadingSemanas = signal(true);
  loadingItems = signal(true);
  loadingLiveClasses = signal(true);

  /** Mapa semana → items combinados (materials + tasks + foros). */
  itemsPorSemana = computed(() => {
    const map = new Map<number, SemanaItem[]>();

    for (const m of this.materials()) {
      const s = m.semana ?? 0;
      if (!s) continue;
      const arr = map.get(s) ?? [];
      arr.push({
        kind: 'material', id: m.id, titulo: m.titulo,
        descripcion: m.descripcion ?? null,
        oculto: m.oculto ?? false,
        fecha: m.created_at, raw: m,
      });
      map.set(s, arr);
    }
    for (const t of this.tasks()) {
      const s = t.semana ?? 0;
      if (!s) continue;
      const arr = map.get(s) ?? [];
      arr.push({
        kind: 'tarea', id: t.id, titulo: t.titulo,
        descripcion: t.instrucciones ?? null,
        oculto: !t.activo,
        fecha: t.created_at ?? t.fecha_limite, raw: t,
      });
      map.set(s, arr);
    }
    for (const f of this.forums()) {
      const s = f.semana ?? 0;
      if (!s) continue;
      const arr = map.get(s) ?? [];
      arr.push({
        kind: 'foro', id: f.id, titulo: f.titulo,
        descripcion: f.descripcion ?? null,
        oculto: f.oculto ?? false,
        fecha: f.created_at, raw: f,
      });
      map.set(s, arr);
    }

    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    }
    return map;
  });

  ngOnInit(): void {
    this.loadSemanas();
    this.loadItems();
    this.loadLiveClasses();
  }

  private loadSemanas(): void {
    this.loadingSemanas.set(true);
    this.csSvc.getSemanas(this.courseId()).subscribe({
      next: (r) => { this.semanas.set(r.data ?? []); this.loadingSemanas.set(false); },
      error: () => { this.semanas.set([]); this.loadingSemanas.set(false); },
    });
  }

  private loadItems(): void {
    this.loadingItems.set(true);
    forkJoin({
      mats: this.csSvc.getMaterials(this.courseId()).pipe(catchError(() => of({ data: [] as Material[] }))),
      tareas: this.taskSvc.getTasks(this.courseId()).pipe(catchError(() => of({ data: [] as Task[] }))),
      foros: this.api.get<Forum[]>(`courses/${this.courseId()}/forums`).pipe(catchError(() => of({ data: [] as Forum[] }))),
    }).subscribe({
      next: ({ mats, tareas, foros }) => {
        this.materials.set(mats.data ?? []);
        this.tasks.set(tareas.data ?? []);
        this.forums.set(foros.data ?? []);
        this.loadingItems.set(false);
      },
      error: () => this.loadingItems.set(false),
    });
  }

  private loadLiveClasses(): void {
    this.loadingLiveClasses.set(true);
    this.csSvc.getLiveClasses(this.courseId()).subscribe({
      next: (r) => {
        this.liveClasses.set([...(r.data ?? [])].sort(
          (a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime(),
        ));
        this.loadingLiveClasses.set(false);
      },
      error: () => { this.liveClasses.set([]); this.loadingLiveClasses.set(false); },
    });
  }

  // ── Helpers ────────────────────────────────────────────────
  itemsEnSemana(n: number): SemanaItem[] {
    return this.itemsPorSemana().get(n) ?? [];
  }

  iconOf(item: SemanaItem): string {
    if (item.kind === 'tarea') {
      const t = item.raw as Task;
      return t.permite_alternativas ? 'quiz' : 'fact_check';
    }
    if (item.kind === 'foro') return 'forum';
    const m = item.raw as Material;
    const map: Record<string, string> = {
      pdf: 'picture_as_pdf', video: 'smart_display',
      link: 'link', grabacion: 'videocam', otro: 'attach_file',
    };
    return map[m.tipo] ?? 'insert_drive_file';
  }

  iconColor(item: SemanaItem): string {
    if (item.kind === 'tarea') return '#1d4ed8';
    if (item.kind === 'foro') return '#0d9488';
    const m = item.raw as Material;
    const map: Record<string, string> = {
      pdf: '#dc2626', video: '#2563eb',
      link: '#16a34a', grabacion: '#9333ea', otro: '#4b5563',
    };
    return map[m.tipo] ?? '#94a3b8';
  }

  metaOf(item: SemanaItem): string {
    if (item.kind === 'tarea') {
      const t = item.raw as Task;
      const f = new Date(t.fecha_limite);
      return `Entrega ${f.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })} · ${t.puntos_max} pts`;
    }
    if (item.kind === 'foro') return 'Foro de discusión';
    const m = item.raw as Material;
    return (m.tipo ?? '').toUpperCase();
  }

  // ── Click → abrir modal lateral según tipo ────────────────
  async abrirItem(item: SemanaItem): Promise<void> {
    if (item.kind === 'material') {
      const m = item.raw as Material;
      const { MaterialPreview } = await import(
        '../../../material-preview/material-preview'
      );
      this.dialog.open(MaterialPreview, {
        data: { courseId: this.courseId(), material: m },
        width: '92vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh',
        position: { right: '0', top: '0' },
        panelClass: 'material-preview-pane',
        enterAnimationDuration: 200, exitAnimationDuration: 150,
      });
      return;
    }

    if (item.kind === 'tarea') {
      const t = item.raw as Task;
      if (this.auth.isAlumno()) {
        // Cargar la entrega previa antes de abrir el modal para que el alumno vea su nota.
        this.taskSvc.getMySubmission(t.id).subscribe({
          next: async (r) => {
            const submission = r.data ?? null;
            const { MySubmissionView } = await import(
              '../../../../tasks/my-submission-view/my-submission-view'
            );
            this.dialog.open(MySubmissionView, {
              data: { task: t, submission },
              width: '92vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh',
              position: { right: '0', top: '0' },
              panelClass: 'material-preview-pane',
              enterAnimationDuration: 200, exitAnimationDuration: 150,
            });
          },
          error: async () => {
            const { MySubmissionView } = await import(
              '../../../../tasks/my-submission-view/my-submission-view'
            );
            this.dialog.open(MySubmissionView, {
              data: { task: t, submission: null },
              width: '92vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh',
              position: { right: '0', top: '0' },
              panelClass: 'material-preview-pane',
              enterAnimationDuration: 200, exitAnimationDuration: 150,
            });
          },
        });
      } else {
        const { TaskSubmissionsPane } = await import(
          '../../../../tasks/task-submissions-pane/task-submissions-pane'
        );
        this.dialog.open(TaskSubmissionsPane, {
          data: { task: t },
          width: '92vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh',
          position: { right: '0', top: '0' },
          panelClass: 'material-preview-pane',
          enterAnimationDuration: 200, exitAnimationDuration: 150,
        });
      }
      return;
    }

    // foro
    const f = item.raw as Forum;
    this.router.navigate(['/foro', f.id]);
  }

  // ── Toggles ────────────────────────────────────────────────
  toggleSemana(s: SemanaResumen, ev: Event): void {
    ev.stopPropagation();
    const oculta = !s.oculta;
    this.csSvc.toggleSemana(this.courseId(), s.semana, oculta).subscribe({
      next: (r) => {
        this.semanas.update((list) => list.map((x) => x.semana === s.semana ? r.data : x));
        this.toastr.success(oculta ? 'Semana oculta para los alumnos' : 'Semana visible', '�xito');
      },
      error: () => this.toastr.error('No se pudo actualizar la semana', 'Error'),
    });
  }

  toggleItem(item: SemanaItem, ev: Event): void {
    ev.stopPropagation();
    if (item.kind === 'material') {
      const oculto = !item.oculto;
      this.csSvc.toggleMaterial(this.courseId(), item.id, oculto).subscribe({
        next: () => this.materials.update((list) => list.map((m) => m.id === item.id ? { ...m, oculto } : m)),
        error: () => this.toastr.error('No se pudo actualizar el material', 'Error'),
      });
    } else if (item.kind === 'tarea') {
      const activo = item.oculto; // si estaba oculto, ahora pasa a activo=true
      this.taskSvc.toggleTask(item.id, activo).subscribe({
        next: () => this.tasks.update((list) => list.map((t) => t.id === item.id ? { ...t, activo } : t)),
        error: () => this.toastr.error('No se pudo actualizar la tarea', 'Error'),
      });
    } else {
      const oculto = !item.oculto;
      this.csSvc.toggleForum(this.courseId(), item.id, oculto).subscribe({
        next: () => this.forums.update((list) => list.map((f) => f.id === item.id ? { ...f, oculto } : f)),
        error: () => this.toastr.error('No se pudo actualizar el foro', 'Error'),
      });
    }
  }

  eliminarItem(item: SemanaItem, ev: Event): void {
    ev.stopPropagation();
    if (item.kind !== 'material') {
      this.toastr.success('Eliminar tareas y foros se implementará pronto', '�xito');
      return;
    }
    if (!confirm(`¿Eliminar "${item.titulo}"?`)) return;
    this.csSvc.deleteMaterial(this.courseId(), item.id).subscribe({
      next: () => {
        this.materials.update((list) => list.filter((m) => m.id !== item.id));
        this.toastr.success('Material eliminado', 'Éxito');
      },
      error: () => this.toastr.error('No se pudo eliminar', 'Error'),
    });
  }

  // ── Crear desde la semana ─────────────────────────────────
  async crearMaterial(s: SemanaResumen, ev: Event): Promise<void> {
    ev.stopPropagation();
    const { MaterialUpload } = await import(
      '../../../material-upload/material-upload/material-upload'
    );
    const ref = this.dialog.open(MaterialUpload, {
      data: { courseId: this.courseId(), bimestre: s.bimestre, semana: s.semana },
      width: '560px', maxHeight: '90vh',
    });
    ref.afterClosed().subscribe((r) => { if (r) this.loadItems(); });
  }

  async crearTarea(s: SemanaResumen, ev: Event): Promise<void> {
    ev.stopPropagation();
    const { TaskCreate } = await import(
      '../../../../tasks/task-create/task-create'
    );
    const ref = this.dialog.open(TaskCreate, {
      data: { courseId: this.courseId(), bimestre: s.bimestre, semana: s.semana },
      width: '760px', maxHeight: '90vh',
    });
    ref.afterClosed().subscribe((r) => { if (r) this.loadItems(); });
  }

  async crearForo(s: SemanaResumen, ev: Event): Promise<void> {
    ev.stopPropagation();
    const { ForumCreate } = await import(
      '../../../../forum/forum-create/forum-create'
    );
    const ref = this.dialog.open(ForumCreate, {
      data: { courseId: this.courseId(), bimestre: s.bimestre, semana: s.semana },
      width: '520px', maxHeight: '90vh',
    });
    ref.afterClosed().subscribe((r) => { if (r) this.loadItems(); });
  }

  // ── Live classes (sin cambios) ────────────────────────────
  estadoClase(lc: LiveClass): 'proxima' | 'en-vivo' | 'finalizada' {
    const inicio = new Date(lc.fecha_hora).getTime();
    const fin = inicio + lc.duracion_min * 60_000;
    const ahora = Date.now();
    if (ahora < inicio - 15 * 60_000) return 'proxima';
    if (ahora > fin) return 'finalizada';
    return 'en-vivo';
  }

  async abrirCrearLiveClass(): Promise<void> {
    const { LiveClassFormDialog } = await import(
      '../../live-class-form-dialog/live-class-form-dialog'
    );
    const ref = this.dialog.open(LiveClassFormDialog, {
      data: { courseId: this.courseId() }, width: '600px', maxHeight: '90vh',
    });
    ref.afterClosed().subscribe((r) => { if (r) this.loadLiveClasses(); });
  }

  async abrirEditarLiveClass(lc: LiveClass): Promise<void> {
    const { LiveClassFormDialog } = await import(
      '../../live-class-form-dialog/live-class-form-dialog'
    );
    const ref = this.dialog.open(LiveClassFormDialog, {
      data: { courseId: this.courseId(), liveClass: lc }, width: '600px', maxHeight: '90vh',
    });
    ref.afterClosed().subscribe((r) => { if (r) this.loadLiveClasses(); });
  }

  eliminarLiveClass(lc: LiveClass): void {
    if (!confirm(`¿Eliminar "${lc.titulo}"?`)) return;
    this.csSvc.deleteLiveClass(lc.id).subscribe({
      next: () => {
        this.liveClasses.update((list) => list.filter((c) => c.id !== lc.id));
        this.toastr.success('Videoconferencia eliminada', '�xito');
      },
      error: (err) => this.toastr.error(err?.error?.message ?? 'Error', 'Error'),
    });
  }

  unirseClase(lc: LiveClass): void { window.open(lc.link_reunion, '_blank'); }

  // ── Aside ─────────────────────────────────────────────────
  iniciales(d?: { nombre?: string; apellido_paterno?: string } | null): string {
    if (!d) return 'D';
    return ((d.nombre?.[0] ?? '') + (d.apellido_paterno?.[0] ?? '')).toUpperCase() || 'D';
  }

  async abrirParticipantes(): Promise<void> {
    const c = this.course();
    if (!c?.seccion_id) {
      this.toastr.error('Este curso no tiene una sección asignada', 'Error');
      return;
    }
    const { CourseParticipants } = await import(
      '../../course-participants/course-participants'
    );
    this.dialog.open(CourseParticipants, {
      data: {
        seccionId: c.seccion_id,
        cursoNombre: c.nombre,
        seccionNombre: c.seccion?.nombre,
      },
      width: '720px', maxWidth: '95vw', height: '85vh', maxHeight: '90vh',
      panelClass: 'cp-dialog',
    });
  }
}

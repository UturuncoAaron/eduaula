import { Component, inject, input, OnInit, signal, computed, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from 'ngx-toastr-notifier';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../../../core/auth/auth';
import { BimestreFilterService } from '@core/models/bimestre-filter';
import { LazyCourseStore } from '../../../data-access/lazy-course.store';
import { CourseService } from '../../../data-access/course.store';
import { TaskService } from '../../../../tasks/data-access/task.store';
import { Course, LiveClass, Material, SemanaResumen } from '../../../../../core/models/course';
import { Task } from '../../../../../core/models/task';
import { Forum } from '../../../../../core/models/forum';
import { TeacherCardSkeleton, WeekContentSkeleton } from '../../../../../shared/components/skeletons/skeletons';
import { formDrawerConfig } from '../../../../../shared/utils/form-drawer';
import { WeekAccordion, SemanaItem } from './week-accordion/week-accordion';

@Component({
  selector: 'app-tab-contenido',
  standalone: true,
  imports: [
    DatePipe, RouterLink, MatIconModule, MatButtonModule, MatExpansionModule,
    MatProgressSpinnerModule, MatMenuModule, MatTooltipModule, WeekAccordion,
    TeacherCardSkeleton, WeekContentSkeleton,
  ],
  templateUrl: './tab-contenido.html',
  styleUrl: './tab-contenido.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabContenido implements OnInit {
  readonly auth = inject(AuthService);
  readonly bimFiltro = inject(BimestreFilterService);
  private readonly store = inject(LazyCourseStore);
  private readonly csSvc = inject(CourseService);
  private readonly taskSvc = inject(TaskService);
  private readonly dialog = inject(MatDialog);
  private readonly toastr = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  courseId = input.required<string>({ alias: 'id' });

  readonly course = signal<Course | null>(null);
  readonly semanas = signal<SemanaResumen[]>([]);
  readonly loadingSemanas = signal(true);
  readonly addingSemana = signal(false);

  readonly semanasFiltradas = computed(() => {
    const bim = this.bimFiltro.bimestre();
    const all = this.semanas();
    return bim === null ? all : all.filter(s => s.bimestre === bim);
  });

  private readonly materialsByWeek = signal<Map<number, Material[]> | null>(null);
  private readonly tasksByWeek = signal<Map<number, Task[]> | null>(null);
  private readonly forumsByWeek = signal<Map<number, Forum[]> | null>(null);
  readonly loadingItems = signal(false);
  private readonly itemsLoaded = computed(() => this.materialsByWeek() !== null);

  readonly liveClasses = signal<LiveClass[] | null>(null);
  readonly loadingLive = signal(false);
  readonly liveClassesCount = computed(() => this.liveClasses()?.length ?? 0);

  ngOnInit(): void {
    this.store.course$(this.courseId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(c => this.course.set(c));

    this.loadingSemanas.set(true);
    this.store.semanas$(this.courseId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(list => {
        this.semanas.set(list);
        this.loadingSemanas.set(false);
      });
  }

  onWeekOpened(): void {
    if (this.itemsLoaded() || this.loadingItems()) return;
    this.loadingItems.set(true);
    this.store.items$(this.courseId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(bundle => {
        this.materialsByWeek.set(bundle.materials);
        this.tasksByWeek.set(bundle.tasks);
        this.forumsByWeek.set(bundle.forums);
        this.loadingItems.set(false);
        this.schedulePrefetch();
      });
  }

  private schedulePrefetch(): void {
    if (this.liveClasses() !== null || this.loadingLive()) return;
    const run = (): void => {
      if (this.liveClasses() !== null || this.loadingLive()) return;
      this.store.liveClasses$(this.courseId())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(list => this.liveClasses.set(list));
    };
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(run, { timeout: 4000 });
    } else {
      setTimeout(run, 2000);
    }
  }

  onLivePanelOpened(): void {
    if (this.liveClasses() !== null || this.loadingLive()) return;
    this.loadingLive.set(true);
    this.store.liveClasses$(this.courseId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(list => {
        this.liveClasses.set(list);
        this.loadingLive.set(false);
      });
  }

  agregarSemana(): void {
    if (this.addingSemana()) return;
    const bimestre = this.bimFiltro.bimestre();
    if (bimestre === null) return;
    this.addingSemana.set(true);

    this.csSvc.addSemana(this.courseId(), bimestre)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r: { data: SemanaResumen }) => {
          const nuevaSemana = r.data;
          this.semanas.update(list => [...list, nuevaSemana]);
          this.store.invalidateSemanas(this.courseId());
          this.addingSemana.set(false);
          this.toastr.success(`Semana ${nuevaSemana.semana} agregada con éxito`, 'Éxito');
        },
        error: (err: { error?: { message?: string } }) => {
          this.addingSemana.set(false);
          this.toastr.error(err?.error?.message ?? 'No se pudo agregar la semana', 'Error');
        },
      });
  }

  itemsForWeek(n: number): SemanaItem[] | null {
    if (!this.itemsLoaded()) return null;
    const out: SemanaItem[] = [];
    for (const m of this.materialsByWeek()!.get(n) ?? []) {
      out.push({ kind: 'material', id: m.id, titulo: m.titulo, descripcion: m.descripcion ?? null, oculto: m.oculto ?? false, fecha: m.created_at, raw: m });
    }
    for (const t of this.tasksByWeek()!.get(n) ?? []) {
      out.push({ kind: 'tarea', id: t.id, titulo: t.titulo, descripcion: t.instrucciones ?? null, oculto: !t.activo, fecha: t.created_at ?? t.fecha_limite, raw: t });
    }
    for (const f of this.forumsByWeek()!.get(n) ?? []) {
      out.push({ kind: 'foro', id: f.id, titulo: f.titulo, descripcion: f.descripcion ?? null, oculto: f.oculto ?? false, fecha: f.created_at, raw: f });
    }
    out.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    return out;
  }

  private refreshItems(): void {
    this.store.invalidateItems(this.courseId());
    this.materialsByWeek.set(null);
    this.tasksByWeek.set(null);
    this.forumsByWeek.set(null);
    this.loadingItems.set(true);
    this.store.items$(this.courseId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(bundle => {
        this.materialsByWeek.set(bundle.materials);
        this.tasksByWeek.set(bundle.tasks);
        this.forumsByWeek.set(bundle.forums);
        this.loadingItems.set(false);
      });
  }

  private refreshLiveClasses(): void {
    this.store.invalidateLiveClasses(this.courseId());
    this.liveClasses.set(null);
    this.onLivePanelOpened();
  }

  async abrirItem(item: SemanaItem): Promise<void> {
    if (item.kind === 'material') {
      const m = item.raw as Material;
      const { MaterialPreview } = await import('../../../material-preview/material-preview');
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
        this.taskSvc.getMySubmission(t.id).subscribe({
          next: async r => {
            const submission = r.data ?? null;
            const { MySubmissionView } = await import('../../../../tasks/my-submission-view/my-submission-view');
            this.dialog.open(MySubmissionView, {
              data: { task: t, submission },
              width: '92vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh',
              position: { right: '0', top: '0' },
              panelClass: 'material-preview-pane',
              enterAnimationDuration: 200, exitAnimationDuration: 150,
            });
          },
          error: async () => {
            const { MySubmissionView } = await import('../../../../tasks/my-submission-view/my-submission-view');
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
        const { TaskSubmissionsPane } = await import('../../../../tasks/task-submissions-pane/task-submissions-pane');
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

    const f = item.raw as Forum;
    const { ForumThread } = await import('../../../../forum/forum-thread/forum-thread');
    this.dialog.open(ForumThread, {
      width: '720px', maxWidth: '100vw', height: '100vh', maxHeight: '100vh',
      position: { right: '0' }, panelClass: 'forum-thread-dialog-panel', autoFocus: false,
      data: { forumId: f.id, courseId: this.courseId() },
    });
  }

  toggleSemana(s: SemanaResumen): void {
    const oculta = !s.oculta;
    this.csSvc.toggleSemana(this.courseId(), s.semana, oculta).subscribe({
      next: r => {
        this.semanas.update(list => list.map(x => x.semana === s.semana ? r.data : x));
        this.store.invalidateSemanas(this.courseId());
        this.toastr.success(oculta ? 'Semana oculta para los alumnos' : 'Semana visible para la sección', 'Éxito');
      },
      error: () => this.toastr.error('No se pudo actualizar el estado de la semana', 'Error'),
    });
  }

  toggleItem(item: SemanaItem): void {
    if (item.kind === 'material') {
      const oculto = !item.oculto;
      this.csSvc.toggleMaterial(this.courseId(), item.id, oculto).subscribe({
        next: () => this.refreshItems(),
        error: () => this.toastr.error('No se pudo actualizar el material', 'Error'),
      });
    } else if (item.kind === 'tarea') {
      const activo = item.oculto;
      this.taskSvc.toggleTask(item.id, activo).subscribe({
        next: () => this.refreshItems(),
        error: () => this.toastr.error('No se pudo actualizar la tarea', 'Error'),
      });
    } else {
      const oculto = !item.oculto;
      this.csSvc.toggleForum(this.courseId(), item.id, oculto).subscribe({
        next: () => this.refreshItems(),
        error: () => this.toastr.error('No se pudo actualizar el foro', 'Error'),
      });
    }
  }

  descargarMaterial(item: SemanaItem): void {
    if (item.kind !== 'material') return;
    this.csSvc.getMaterialDownload(this.courseId(), item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: r => {
          const { url, filename, kind } = r.data;
          if (kind === 'link') {
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
          }
          const a = document.createElement('a');
          a.href = url; a.download = filename;
          document.body.appendChild(a);
          a.click(); a.remove();
        },
        error: () => this.toastr.error('No se pudo descargar el archivo', 'Error'),
      });
  }

  eliminarItem(item: SemanaItem): void {
    if (item.kind !== 'material') return;
    if (!confirm(`¿Estás seguro de eliminar el recurso "${item.titulo}"?`)) return;
    this.csSvc.deleteMaterial(this.courseId(), item.id).subscribe({
      next: () => {
        this.refreshItems();
        this.toastr.success('Material eliminado del catálogo del aula', 'Éxito');
      },
      error: () => this.toastr.error('No se pudo eliminar el recurso', 'Error'),
    });
  }

  async crearMaterial(s: SemanaResumen): Promise<void> {
    const { MaterialUpload } = await import('../../../material-upload/material-upload');
    const ref = this.dialog.open(MaterialUpload, formDrawerConfig({ courseId: this.courseId(), bimestre: s.bimestre, semana: s.semana }, 'md'));
    ref.afterClosed().subscribe(r => { if (r) this.refreshItems(); });
  }

  async crearTarea(s: SemanaResumen): Promise<void> {
    const { TaskCreate } = await import('../../../../tasks/task-create/task-create');
    const ref = this.dialog.open(TaskCreate, formDrawerConfig({ courseId: this.courseId(), bimestre: s.bimestre, semana: s.semana }, 'lg'));
    ref.afterClosed().subscribe(r => { if (r) this.refreshItems(); });
  }

  async crearForo(s: SemanaResumen): Promise<void> {
    const { ForumCreate } = await import('../../../../forum/forum-create/forum-create');
    const ref = this.dialog.open(ForumCreate, formDrawerConfig({ courseId: this.courseId(), bimestre: s.bimestre, semana: s.semana }, 'md'));
    ref.afterClosed().subscribe(r => { if (r) this.refreshItems(); });
  }

  estadoClase(lc: LiveClass): 'proxima' | 'en-vivo' | 'finalizada' {
    const inicio = new Date(lc.fecha_hora).getTime();
    const fin = inicio + lc.duracion_min * 60_000;
    const ahora = Date.now();
    if (ahora < inicio - 15 * 60_000) return 'proxima';
    if (ahora > fin) return 'finalizada';
    return 'en-vivo';
  }

  async abrirCrearLiveClass(): Promise<void> {
    const { LiveClassFormDialog } = await import('../../live-class-form-dialog/live-class-form-dialog');
    const ref = this.dialog.open(LiveClassFormDialog, {
      data: { courseId: this.courseId() },
      width: '550px',
      maxWidth: '95vw'
    });

    ref.afterClosed().subscribe(r => { if (r) this.refreshLiveClasses(); });
  }

  async abrirEditarLiveClass(lc: LiveClass): Promise<void> {
    const { LiveClassFormDialog } = await import('../../live-class-form-dialog/live-class-form-dialog');
    const ref = this.dialog.open(LiveClassFormDialog, {
      data: { courseId: this.courseId(), liveClass: lc },
      width: '550px',
      maxWidth: '95vw'
    });

    ref.afterClosed().subscribe(r => { if (r) this.refreshLiveClasses(); });
  }

  eliminarLiveClass(lc: LiveClass): void {
    if (!confirm(`¿Eliminar la videoconferencia "${lc.titulo}" del calendario?`)) return;
    this.csSvc.deleteLiveClass(lc.id).subscribe({
      next: () => {
        this.liveClasses.update(list => (list ?? []).filter(c => c.id !== lc.id));
        this.toastr.success('Videoconferencia eliminada correctamente', 'Éxito');
      },
      error: err => this.toastr.error(err?.error?.message ?? 'Error al remover la sesión', 'Error'),
    });
  }

  unirseClase(lc: LiveClass): void { window.open(lc.link_reunion, '_blank'); }

  iniciales(d?: { nombre?: string; apellido_paterno?: string } | null): string {
    if (!d) return 'D';
    return ((d.nombre?.[0] ?? '') + (d.apellido_paterno?.[0] ?? '')).toUpperCase() || 'D';
  }

  async abrirParticipantes(): Promise<void> {
    const c = this.course();
    if (!c?.seccion_id) {
      this.toastr.error('Este curso no tiene una sección válida asignada', 'Error');
      return;
    }
    const { CourseParticipants } = await import('../../course-participants/course-participants');
    this.dialog.open(CourseParticipants, {
      data: { seccionId: c.seccion_id, cursoNombre: c.nombre, seccionNombre: c.seccion?.nombre },
      width: '720px', maxWidth: '95vw', height: '85vh', maxHeight: '90vh', panelClass: 'cp-dialog',
    });
  }
}
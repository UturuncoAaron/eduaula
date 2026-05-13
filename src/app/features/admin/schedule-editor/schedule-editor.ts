import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnInit,
  HostListener,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import {
  CourseSchedule,
  DiaSemana,
  DIAS,
  EditableSlot,
  ServerSlot,
  toMinutes,
} from './schedule-editor.types';
import { ScheduleGrid } from './schedule-grid';
import {
  SlotAssignDialog,
  SlotAssignData,
  SlotAssignResult,
} from './slot-assign-dialog';

interface PendingPayloadSlot {
  curso_id: string;
  dia_semana: DiaSemana;
  hora_inicio: string;
  hora_fin: string;
  aula: string | null;
}

@Component({
  selector: 'app-schedule-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatButtonModule, MatIconModule,
    MatDialogModule, MatTooltipModule,
    MatProgressBarModule, MatProgressSpinnerModule,
    ScheduleGrid,
  ],
  templateUrl: './schedule-editor.html',
  styleUrl: './schedule-editor.scss',
})
export class ScheduleEditor implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly api = inject(ApiService);
  private readonly toastr = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  // Params + query
  readonly seccionId = this.route.snapshot.paramMap.get('seccionId')!;
  readonly periodoId = this.route.snapshot.paramMap.get('periodoId')!;
  readonly seccionNombre = this.route.snapshot.queryParamMap.get('seccion') ?? '';
  readonly gradoNombre = this.route.snapshot.queryParamMap.get('grado') ?? '';

  // Estado base
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly courses = signal<CourseSchedule[]>([]);

  // Estado editable
  readonly workingCourses = signal<CourseSchedule[]>([]);
  /** curso_ids cuyos slots cambiaron y deben guardarse al "Save". */
  readonly dirtyCourses = signal<Set<string>>(new Set());

  // Constantes UI
  readonly dias = DIAS;

  readonly isDirty = computed(() => this.dirtyCourses().size > 0);
  readonly dirtyCount = computed(() => this.dirtyCourses().size);

  /** Map para acceso rápido curso_id → curso (con color, nombre). */
  private readonly courseLookup = computed(() => {
    const m = new Map<string, CourseSchedule>();
    for (const c of this.workingCourses()) m.set(c.curso_id, c);
    return m;
  });

  /** Vista plana de slots con metadata del curso, para pintar el grid. */
  readonly flatSlots = computed<EditableSlot[]>(() => {
    const out: EditableSlot[] = [];
    for (const c of this.workingCourses()) {
      for (const s of c.slots) {
        out.push({
          ...s,
          curso_id: c.curso_id,
          curso_nombre: c.curso_nombre,
          color: c.color,
          // El "pending" lo decidimos por presencia del curso en dirtyCourses.
          pending: this.dirtyCourses().has(c.curso_id),
        });
      }
    }
    return out;
  });

  // ─── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api
      .get<CourseSchedule[]>(`schedule/section/${this.seccionId}/period/${this.periodoId}`)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: r => {
          const data = (r.data ?? []).map(c => ({
            ...c,
            slots: (c.slots ?? []).map(s => ({
              id: s.id,
              dia_semana: s.dia_semana,
              hora_inicio: s.hora_inicio.slice(0, 5),
              hora_fin: s.hora_fin.slice(0, 5),
              aula: s.aula ?? null,
            }) as ServerSlot),
          }));
          this.courses.set(data);
          this.workingCourses.set(clone(data));
          this.dirtyCourses.set(new Set());
        },
        error: () => {
          this.toastr.error('No se pudo cargar el horario', 'Error');
          this.courses.set([]);
          this.workingCourses.set([]);
        },
      });
  }

  // ─── Grid interaction (delegadas desde <app-schedule-grid>) ────
  onGridCreate(payload: { dia: DiaSemana; hora: string }): void {
    this.openCreateDialog(payload.dia, payload.hora);
  }

  onGridEdit(slot: EditableSlot): void {
    this.openEditDialog(slot);
  }

  private openCreateDialog(dia: DiaSemana, hora: string): void {
    const courses = this.workingCourses();
    if (courses.length === 0) {
      this.toastr.error('No hay cursos en esta sección. Crea cursos primero.');
      return;
    }
    const ref = this.dialog.open<SlotAssignDialog, SlotAssignData, SlotAssignResult | null>(
      SlotAssignDialog,
      {
        width: '480px',
        data: {
          courses,
          dia,
          horaInicio: hora,
          preselectedCursoId: courses[0].curso_id,
          editingSlot: null,
        },
      },
    );
    ref.afterClosed().subscribe(res => this.applyDialogResult(res));
  }

  private openEditDialog(slot: EditableSlot): void {
    const courses = this.workingCourses();
    const ref = this.dialog.open<SlotAssignDialog, SlotAssignData, SlotAssignResult | null>(
      SlotAssignDialog,
      {
        width: '480px',
        data: {
          courses,
          dia: slot.dia_semana,
          horaInicio: slot.hora_inicio,
          preselectedCursoId: slot.curso_id,
          editingSlot: {
            id: slot.id,
            curso_id: slot.curso_id,
            dia_semana: slot.dia_semana,
            hora_inicio: slot.hora_inicio,
            hora_fin: slot.hora_fin,
            aula: slot.aula,
          },
        },
      },
    );
    ref.afterClosed().subscribe(res => this.applyDialogResult(res));
  }

  private applyDialogResult(res: SlotAssignResult | null | undefined): void {
    if (!res) return;

    if (res.action === 'delete') {
      this.removeSlot(res.originalCursoId!, res.originalSlotId!);
      return;
    }

    // action === 'save'
    const newSlot: PendingPayloadSlot = {
      curso_id: res.curso_id,
      dia_semana: res.dia_semana,
      hora_inicio: res.hora_inicio,
      hora_fin: res.hora_fin,
      aula: res.aula,
    };

    if (this.hasOverlapInCourse(newSlot, res.originalSlotId ?? null)) {
      this.toastr.error('Ese bloque se solapa con otro slot del mismo curso.');
      return;
    }

    if (res.originalSlotId != null) {
      // Editando un slot existente — puede haber cambiado de curso.
      this.removeSlot(res.originalCursoId!, res.originalSlotId);
    }
    this.addSlot(newSlot);
  }

  private hasOverlapInCourse(slot: PendingPayloadSlot, ignoreSlotId: number | string | null): boolean {
    const course = this.courseLookup().get(slot.curso_id);
    if (!course) return false;
    const a = toMinutes(slot.hora_inicio);
    const b = toMinutes(slot.hora_fin);
    return course.slots.some(s => {
      if (s.id === ignoreSlotId) return false;
      if (s.dia_semana !== slot.dia_semana) return false;
      return toMinutes(s.hora_inicio) < b && toMinutes(s.hora_fin) > a;
    });
  }

  private addSlot(slot: PendingPayloadSlot): void {
    this.workingCourses.update(courses =>
      courses.map(c => {
        if (c.curso_id !== slot.curso_id) return c;
        const next: ServerSlot = {
          id: tempSlotId(),
          dia_semana: slot.dia_semana,
          hora_inicio: slot.hora_inicio,
          hora_fin: slot.hora_fin,
          aula: slot.aula,
        };
        return { ...c, slots: [...c.slots, next] };
      }),
    );
    this.markDirty(slot.curso_id);
  }

  private removeSlot(cursoId: string, slotId: number | string): void {
    this.workingCourses.update(courses =>
      courses.map(c => {
        if (c.curso_id !== cursoId) return c;
        return { ...c, slots: c.slots.filter(s => s.id !== slotId) };
      }),
    );
    this.markDirty(cursoId);
  }

  private markDirty(cursoId: string): void {
    this.dirtyCourses.update(s => {
      const next = new Set(s);
      next.add(cursoId);
      return next;
    });
  }

  // ─── Save / discard ────────────────────────────────────────────
  save(): void {
    if (this.saving() || this.dirtyCourses().size === 0) return;
    const dirty = Array.from(this.dirtyCourses());
    this.saving.set(true);

    const requests = dirty.map(cursoId => {
      const course = this.courseLookup().get(cursoId);
      const slots = (course?.slots ?? []).map(s => ({
        curso_id: cursoId,
        dia_semana: s.dia_semana,
        hora_inicio: s.hora_inicio,
        hora_fin: s.hora_fin,
        aula: s.aula ?? undefined,
      }));
      return this.api.put(`schedule/course/${cursoId}`, { slots }).pipe(
        catchError(() => of(null)),
      );
    });

    forkJoin(requests)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe(results => {
        const failed = results.filter(r => r === null).length;
        if (failed > 0) {
          this.toastr.error(`No se pudieron guardar ${failed} curso(s)`);
        } else {
          this.toastr.success('Horario guardado');
        }
        this.load();
      });
  }

  discard(): void {
    if (this.dirtyCourses().size === 0) return;
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Descartar cambios',
        message: '¿Descartar los cambios sin guardar? Esto restaurará el horario tal como está en la base.',
        confirm: 'Descartar',
        danger: true,
      },
    });
    ref.afterClosed().subscribe(ok => {
      if (!ok) return;
      this.workingCourses.set(clone(this.courses()));
      this.dirtyCourses.set(new Set());
    });
  }

  // ─── Crear cursos sin salir del editor ───────────────────────
  /**
   * Cuando la sección no tiene cursos (o el admin quiere agregar uno
   * más) lanzamos el plantillado CNEB para que el editor de horario sea
   * usable de inmediato sin tener que viajar a otra pantalla.
   */
  generateCoursesFromTemplate(): void {
    if (this.saving()) return;
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Generar cursos por plantilla',
        message:
          'Vamos a crear los cursos estándar del grado en esta sección. ' +
          'Los que ya existen no se duplicarán. ¿Continuar?',
        confirm: 'Generar',
      },
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.saving.set(true);
      this.api
        .post(`courses/generate/${this.seccionId}/${this.periodoId}`, {})
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: (r) => {
            const data = r.data as { mensaje?: string } | undefined;
            this.toastr.success(data?.mensaje ?? 'Cursos generados');
            this.load();
          },
          error: () => {
            this.toastr.error('No se pudo generar los cursos');
          },
        });
    });
  }

  back(): void {
    if (this.dirtyCourses().size === 0) { this.goBack(); return; }
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Salir sin guardar',
        message: 'Tenés cambios sin guardar. ¿Salir igual?',
        confirm: 'Salir sin guardar',
        danger: true,
      },
    });
    ref.afterClosed().subscribe(ok => {
      if (ok) this.goBack();
    });
  }

  private goBack(): void {
    if (window.history.length > 1) this.location.back();
    else this.router.navigate(['/admin/academico']);
  }

  // Bloquea recarga / cierre si hay cambios sin guardar.
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(ev: BeforeUnloadEvent): void {
    if (this.dirtyCourses().size === 0) return;
    ev.preventDefault();
    ev.returnValue = '';
  }
}

// ─── helpers ────────────────────────────────────────────────────
function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

let _tempCounter = 1;
function tempSlotId(): string { return `__pending_${_tempCounter++}`; }

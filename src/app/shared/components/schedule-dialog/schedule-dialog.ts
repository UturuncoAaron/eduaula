import {
  Component, inject, signal, computed, OnInit,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ReactiveFormsModule, FormBuilder, FormArray, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api';

// ── Types ──────────────────────────────────────────────────────

export interface ScheduleDialogData {
  seccionId: number;
  periodoId: number;
  seccionNombre: string;
  gradoNombre: string;
}

export interface TimeSlot {
  id?: number;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string;
}

export interface CourseSchedule {
  curso_id: string;
  curso_nombre: string;
  color: string;
  slots: TimeSlot[];
}

// ── Constants ──────────────────────────────────────────────────

const WEEK_DAYS = [
  { value: 'lunes', label: 'Lunes' },
  { value: 'martes', label: 'Martes' },
  { value: 'miercoles', label: 'Miércoles' },
  { value: 'jueves', label: 'Jueves' },
  { value: 'viernes', label: 'Viernes' },
];

// Half-hour slots 07:00 → 17:30
const TIME_OPTIONS = Array.from({ length: 22 }, (_, i) => {
  const hour = Math.floor(i / 2) + 7;
  const minute = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minute}`;
});

// ── Component ──────────────────────────────────────────────────

@Component({
  selector: 'app-schedule-dialog',
  standalone: true,
  imports: [
    MatDialogModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatInputModule, MatFormFieldModule,
    MatSnackBarModule, MatProgressSpinnerModule,
    MatTooltipModule, ReactiveFormsModule,
  ],
  templateUrl: './schedule-dialog.html',
  styleUrl: './schedule-dialog.scss',
})
export class ScheduleDialog implements OnInit {
  readonly data = inject<ScheduleDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ScheduleDialog>);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  // ── State ─────────────────────────────────────────────────────
  courses = signal<CourseSchedule[]>([]);
  loading = signal(true);
  saving = signal(false);
  selectedId = signal<string | null>(null);

  readonly weekDays = WEEK_DAYS;
  readonly timeOptions = TIME_OPTIONS;

  slotsForm = this.fb.group({ slots: this.fb.array<FormGroup>([]) });

  get slotsArray(): FormArray {
    return this.slotsForm.get('slots') as FormArray;
  }

  selectedCourse = computed(() =>
    this.courses().find(c => c.curso_id === this.selectedId()) ?? null,
  );

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void { this.loadSchedule(); }

  loadSchedule(): void {
    this.loading.set(true);
    this.api.get<CourseSchedule[]>(
      `schedule/section/${this.data.seccionId}/period/${this.data.periodoId}`,
    ).subscribe({
      next: r => {
        this.courses.set(r.data ?? []);
        if (r.data?.length) this.selectCourse(r.data[0].curso_id);
        this.loading.set(false);
      },
      error: () => {
        this.snack.open('Error al cargar el horario', 'Cerrar', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }

  // ── Course selection ──────────────────────────────────────────
  selectCourse(courseId: string): void {
    this.selectedId.set(courseId);
    const course = this.courses().find(c => c.curso_id === courseId);
    if (!course) return;
    this.slotsArray.clear();
    course.slots.forEach(s => this.slotsArray.push(this.buildSlotGroup(s)));
  }

  // ── Slot management ───────────────────────────────────────────
  addSlot(): void {
    this.slotsArray.push(this.buildSlotGroup());
  }

  removeSlot(index: number): void {
    this.slotsArray.removeAt(index);
  }

  save(): void {
    if (this.slotsForm.invalid || !this.selectedId()) return;
    this.saving.set(true);

    const slots = this.slotsArray.value.map((s: any) => ({
      curso_id: this.selectedId()!,
      dia_semana: s.dia_semana,
      hora_inicio: s.hora_inicio,
      hora_fin: s.hora_fin,
      aula: s.aula?.trim() || null,
    }));

    // Backend espera body: { slots: [...] }
    this.api.put<any>(`schedule/course/${this.selectedId()}`, { slots }).subscribe({
      next: () => {
        this.courses.update(list => list.map(c =>
          c.curso_id === this.selectedId()
            ? { ...c, slots: this.slotsArray.value }
            : c,
        ));
        this.snack.open('Horario guardado', 'OK', { duration: 2000 });
        this.saving.set(false);
      },
      error: (err) => {
        this.snack.open(
          err.error?.message ?? 'Error al guardar el horario',
          'Cerrar', { duration: 4000 },
        );
        this.saving.set(false);
      },
    });
  }

  close(): void { this.dialogRef.close(); }

  // ── Helpers ───────────────────────────────────────────────────
  private buildSlotGroup(s?: Partial<TimeSlot>): FormGroup {
    return this.fb.group({
      dia_semana: [s?.dia_semana ?? 'lunes', Validators.required],
      hora_inicio: [s?.hora_inicio ?? '07:30', Validators.required],
      hora_fin: [s?.hora_fin ?? '08:20', Validators.required],
      aula: [s?.aula ?? ''],
    });
  }
}
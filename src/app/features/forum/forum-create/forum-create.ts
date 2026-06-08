import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../../core/services/api';
import { Period } from '../../../core/models/academic';

export interface ForumCreateData {
  courseId: string;
  bimestre?: number | null;
  semana?: number | null;
}

interface SemanaItem {
  semana: number;
  bimestre: number | null;
}

@Component({
  selector: 'app-forum-create',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
  ],
  templateUrl: './forum-create.html',
  styleUrl: './forum-create.scss',
})
export class ForumCreate implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private dialogRef = inject(MatDialogRef<ForumCreate>);
  private dialogData = inject<string | ForumCreateData>(MAT_DIALOG_DATA);

  private get courseId(): string {
    return typeof this.dialogData === 'string' ? this.dialogData : this.dialogData.courseId;
  }

  private get defaultBimestre(): number | null {
    return typeof this.dialogData === 'string' ? null : this.dialogData.bimestre ?? null;
  }

  private get defaultSemana(): number | null {
    return typeof this.dialogData === 'string' ? null : this.dialogData.semana ?? null;
  }

  bimestresDisponibles = signal<number[]>([]);
  semanasDisponibles = signal<SemanaItem[]>([]);
  loading = signal(false);

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    bimestre: [this.defaultBimestre as number | null],
    semana: [this.defaultSemana as number | null],
  });

  private formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.value,
  });

  semanasFiltradas = computed(() => {
    const bimestre = this.formValue().bimestre;
    const todas = this.semanasDisponibles();
    if (bimestre == null) return todas;
    return todas.filter(s => s.bimestre === bimestre);
  });

  ngOnInit() {
    const anioActual = new Date().getFullYear();

    forkJoin({
      periodos: this.api.get<Period[]>('academic/periodos').pipe(map(r => r.data)),
      semanas: this.api.get<SemanaItem[]>(`courses/${this.courseId}/semanas`).pipe(map(r => r.data)),
    }).subscribe({
      next: ({ periodos, semanas }) => {
        const bimestres = [
          ...new Set(
            periodos
              .filter(p => p.anio === anioActual)
              .map(p => p.bimestre)
              .sort((a, b) => a - b)
          ),
        ];
        this.bimestresDisponibles.set(bimestres);
        this.semanasDisponibles.set(semanas);
      },
      error: () => {
        this.toastr.error('No se pudieron cargar bimestres y semanas', 'Error');
      },
    });
  }

  onBimestreChange() {
    const semanaActual = this.form.value.semana;
    const sigueDisponible = this.semanasFiltradas().some(s => s.semana === semanaActual);
    if (!sigueDisponible) {
      this.form.controls.semana.setValue(null);
    }
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    const v = this.form.value;
    this.api.post(`courses/${this.courseId}/forums`, {
      titulo: v.titulo,
      descripcion: v.descripcion,
      bimestre: v.bimestre ?? null,
      semana: v.semana ?? null,
    }).subscribe({
      next: () => {
        this.toastr.success('Foro creado correctamente', 'Éxito');
        this.dialogRef.close(true);
      },
      error: () => {
        this.toastr.error('Error al crear el foro', 'Error');
        this.loading.set(false);
      },
    });
  }
}
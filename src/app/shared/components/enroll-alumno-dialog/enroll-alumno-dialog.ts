import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { debounceTime, distinctUntilChanged, switchMap, filter, catchError, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiService } from '../../../core/services/api';

export interface EnrollAlumnoDialogData {
  seccionId: number;
  periodoId: number;
  seccionNombre: string;
  gradoNombre: string;
  alumnosMatriculadosIds: string[];
}

export interface AlumnoSearchResult {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  codigo_estudiante: string;
  numero_documento?: string;
}

// Extrae array de cualquier nivel de anidamiento del TransformInterceptor
function unwrapArray(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

@Component({
  selector: 'app-enroll-alumno-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule,
    MatSnackBarModule, MatProgressSpinnerModule,
  ],
  templateUrl: './enroll-alumno-dialog.html',
  styleUrl: './enroll-alumno-dialog.scss',
})
export class EnrollAlumnoDialog implements OnInit {
  readonly data: EnrollAlumnoDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<EnrollAlumnoDialog>);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  searchCtrl = new FormControl('');
  searching = signal(false);
  saving = signal(false);
  results = signal<AlumnoSearchResult[]>([]);
  selectedId = signal<string | null>(null);

  selectedAlumno = computed(() =>
    this.results().find(a => a.id === this.selectedId()) ?? null
  );

  ngOnInit() {
    this.searchCtrl.valueChanges.pipe(
      filter(v => typeof v === 'string' && v.trim().length >= 2),
      tap(() => { this.searching.set(true); this.results.set([]); this.selectedId.set(null); }),
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(q =>
        this.api.get<any>(`admin/users/alumnos/search?q=${encodeURIComponent(q!.trim())}`).pipe(
          catchError(() => of({ data: [] })),
        )
      ),
    ).subscribe(res => {
      // ← Fix: usar unwrapArray para manejar cualquier nivel de anidamiento
      const all = unwrapArray(res);
      this.results.set(
        all.filter((a: AlumnoSearchResult) =>
          !this.data.alumnosMatriculadosIds.includes(a.id)
        )
      );
      this.searching.set(false);
    });
  }

  select(id: string) {
    this.selectedId.set(this.selectedId() === id ? null : id);
  }

  submit() {
    if (!this.selectedId()) return;
    this.saving.set(true);

    this.api.post('courses/enroll', {
      alumnoId: this.selectedId(),
      seccionId: this.data.seccionId,
      periodoId: this.data.periodoId,
    }).subscribe({
      next: () => {
        const a = this.selectedAlumno();
        this.snack.open(
          `${a?.nombre} ${a?.apellido_paterno} matriculado correctamente`,
          'OK', { duration: 3000 },
        );
        this.ref.close(this.selectedAlumno());
      },
      error: (err) => {
        this.snack.open(err?.error?.message ?? 'Error al matricular', 'Cerrar', { duration: 4000 });
        this.saving.set(false);
      },
    });
  }

  cancel() { this.ref.close(null); }
}
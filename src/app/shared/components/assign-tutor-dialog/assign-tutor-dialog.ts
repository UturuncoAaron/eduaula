import {
  Component, ChangeDetectionStrategy,
  inject, signal, computed, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';

import {
  MatDialogModule, MatDialogRef, MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ApiService } from '../../../core/services/api';

export interface AssignTutorDialogData {
  seccionId: number;
  seccionNombre: string;
  gradoNombre: string;
  tutorActualId: string | null;
}

interface DocenteItem {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  /** Sección donde ya es tutor (si aplica) — para advertir al admin */
  tutoria_actual?: {
    seccion_id: number;
    seccion_label: string;          // ej: "1ro A — Secundaria"
  } | null;
}

@Component({
  selector: 'app-assign-tutor-dialog',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatDialogModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './assign-tutor-dialog.html',
  styleUrl: './assign-tutor-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignTutorDialog implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  public ref = inject(MatDialogRef<AssignTutorDialog>);
  public data = inject<AssignTutorDialogData>(MAT_DIALOG_DATA);

  docentes = signal<DocenteItem[]>([]);
  loading = signal(true);
  saving = signal(false);

  selectedId = signal<string | null>(null);
  search = new FormControl('');
  searchValue = signal('');

  docentesFiltrados = computed(() => {
    const q = this.searchValue().toLowerCase().trim();
    const list = this.docentes();
    if (!q) return list;
    return list.filter(d =>
      `${d.nombre} ${d.apellido_paterno} ${d.apellido_materno ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  });

  ngOnInit() {
    this.selectedId.set(this.data.tutorActualId);

    this.api.get<DocenteItem[]>('admin/users/docentes?include=tutoria')
      .subscribe({
        next: (r: any) => {
          this.docentes.set(r.data ?? r ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snack.open('Error al cargar docentes', 'Cerrar', { duration: 3000 });
        },
      });

    this.search.valueChanges.pipe(debounceTime(150)).subscribe(v =>
      this.searchValue.set(v ?? ''),
    );
  }

  select(d: DocenteItem) {
    this.selectedId.set(d.id);
  }

  initials(d: DocenteItem): string {
    return `${(d.nombre[0] ?? '')}${(d.apellido_paterno[0] ?? '')}`.toUpperCase();
  }

  isYaTutorDeOtra(d: DocenteItem): boolean {
    return !!(d.tutoria_actual && d.tutoria_actual.seccion_id !== this.data.seccionId);
  }

  save() {
    const id = this.selectedId();
    if (!id) return;

    const docente = this.docentes().find(d => d.id === id);
    const yaTutor = docente && this.isYaTutorDeOtra(docente);

    // Si ya es tutor de otra sección, el backend devuelve 409 si no se fuerza.
    // Aquí confirmamos antes de mandar `force: true`.
    if (yaTutor) {
      const ok = confirm(
        `${docente!.nombre} ${docente!.apellido_paterno} ya es tutor de ` +
        `${docente!.tutoria_actual!.seccion_label}.\n\n` +
        `¿Quieres reemplazar y asignarlo a ${this.data.gradoNombre} ${this.data.seccionNombre}?`,
      );
      if (!ok) return;
    }

    this.saving.set(true);
    this.api.patch<any>(
      `academic/secciones/${this.data.seccionId}/tutor`,
      { docente_id: id, force: yaTutor || undefined },
    ).subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open('Tutor asignado', 'OK', { duration: 2500 });
        this.ref.close({ docente_id: id });
      },
      error: (err) => {
        this.saving.set(false);
        this.snack.open(
          err?.error?.message ?? 'Error al asignar tutor',
          'Cerrar', { duration: 4000 },
        );
      },
    });
  }

  quitar() {
    if (!confirm('¿Quitar el tutor de esta sección?')) return;
    this.saving.set(true);
    this.api.patch<any>(
      `academic/secciones/${this.data.seccionId}/tutor`,
      { docente_id: null },
    ).subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open('Tutor removido', 'OK', { duration: 2500 });
        this.ref.close({ docente_id: null });
      },
      error: () => {
        this.saving.set(false);
        this.snack.open('Error al quitar tutor', 'Cerrar', { duration: 3000 });
      },
    });
  }

  cancel() {
    this.ref.close();
  }
}

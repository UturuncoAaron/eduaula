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

import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';

export interface AssignTutorDialogData {
  seccionId: string;
  seccionNombre: string;
  gradoNombre: string;
  tutorActualId: string | null;
}

interface DocenteItem {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  tutoria_actual?: {
    seccion_id: string;
    seccion_label: string;
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
  private api    = inject(ApiService);
  private toastr = inject(ToastService);
  public ref     = inject(MatDialogRef<AssignTutorDialog>);
  public data    = inject<AssignTutorDialogData>(MAT_DIALOG_DATA);

  docentes  = signal<DocenteItem[]>([]);
  loading   = signal(true);
  saving    = signal(false);

  selectedId  = signal<string | null>(null);
  search      = new FormControl('');
  searchValue = signal('');

  docentesFiltrados = computed(() => {
    const q    = this.searchValue().toLowerCase().trim();
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

    this.api.get<DocenteItem[]>('admin/users/docentes/select?include=tutoria')
      .subscribe({
        next: (r: any) => {
          this.docentes.set(Array.isArray(r?.data) ? r.data : []);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toastr.error('No se pudieron cargar los docentes', 'Error');
        },
      });

    this.search.valueChanges
      .pipe(debounceTime(150))
      .subscribe(v => this.searchValue.set(v ?? ''));
  }

  select(d: DocenteItem) {
    this.selectedId.set(d.id);
  }

  initials(d: DocenteItem): string {
    return `${d.nombre[0] ?? ''}${d.apellido_paterno[0] ?? ''}`.toUpperCase();
  }

  isYaTutorDeOtra(d: DocenteItem): boolean {
    return !!(d.tutoria_actual && d.tutoria_actual.seccion_id !== this.data.seccionId);
  }

  save() {
    const id = this.selectedId();
    if (!id) return;

    const docente  = this.docentes().find(d => d.id === id);
    const yaTutor  = docente && this.isYaTutorDeOtra(docente);

    if (yaTutor) {
      const ok = confirm(
        `${docente!.nombre} ${docente!.apellido_paterno} ya es tutor de ` +
        `${docente!.tutoria_actual!.seccion_label}.\n\n` +
        `¿Quieres reasignarlo a ${this.data.gradoNombre} – Sección ${this.data.seccionNombre}?`,
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
        this.toastr.success('Tutor asignado correctamente', 'Éxito');
        this.ref.close({ docente_id: id });
      },
      error: (err) => {
        this.saving.set(false);
        this.toastr.error(
          err?.error?.message ?? 'No se pudo asignar el tutor',
          'Error',
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
        this.toastr.success('Tutor removido correctamente', 'Éxito');
        this.ref.close({ docente_id: null });
      },
      error: () => {
        this.saving.set(false);
        this.toastr.error('No se pudo quitar el tutor', 'Error');
      },
    });
  }

  cancel() {
    this.ref.close();
  }
}
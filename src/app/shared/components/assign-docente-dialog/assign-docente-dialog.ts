import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api';

export interface AssignDocenteData {
  cursoId: string;
  cursoNombre: string;
  docenteActualId?: string | null;
}

interface Docente {
  id: string;
  nombre: string;
  apellido_paterno: string;
  especialidad: string | null;
}

@Component({
  selector: 'app-assign-docente-dialog',
  imports: [
    FormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './assign-docente-dialog.html',
  styleUrl: './assign-docente-dialog.scss',
})
export class AssignDocenteDialog implements OnInit {
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef<AssignDocenteDialog>);
  readonly data = inject<AssignDocenteData>(MAT_DIALOG_DATA);

  docentes = signal<Docente[]>([]);
  loading = signal(true);
  saving = signal(false);
  searchQuery = '';
  selectedId = signal<string | null>(null);

  docentesFiltrados = computed(() => {
    const q = this.searchQuery.toLowerCase();
    if (!q) return this.docentes();
    return this.docentes().filter(d =>
      `${d.nombre} ${d.apellido_paterno}`.toLowerCase().includes(q)
    );
  });

  ngOnInit() {
    this.selectedId.set(this.data.docenteActualId ?? null);

    this.api.get<Docente[]>('admin/users/docentes').subscribe({
      next: r => {
        this.docentes.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  select(id: string) {
    this.selectedId.set(this.selectedId() === id ? null : id);
  }

  submit() {
    if (!this.selectedId()) return;
    this.dialogRef.close(this.selectedId());
  }

  cancel() {
    this.dialogRef.close(null);
  }
}
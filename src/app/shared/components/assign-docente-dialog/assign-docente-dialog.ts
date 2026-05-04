import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { ApiService } from '../../../core/services/api';
import { UserAvatar } from '../../../shared/components/user-avatar/user-avatar';
// ↑ ajustá esta ruta al lugar real de tu UserAvatar

export interface AssignDocenteData {
  cursoId: string;
  cursoNombre: string;
  docenteActualId?: string | null;
}

interface Docente {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string | null;
  especialidad: string | null;
  foto_url?: string | null;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Component({
  selector: 'app-assign-docente-dialog',
  imports: [
    FormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatIconModule,
    MatProgressSpinnerModule, MatDividerModule,
    UserAvatar
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

  readonly skeletonRows = [1, 2, 3, 4];

  docentesFiltrados = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    const list = this.docentes();
    if (!q) return list;
    return list.filter(d =>
      `${d.nombre} ${d.apellido_paterno} ${d.apellido_materno ?? ''} ${d.especialidad ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  });

  canSubmit = computed(() => {
    const id = this.selectedId();
    return !!id && id !== this.data.docenteActualId;
  });

  submitLabel = computed(() =>
    this.data.docenteActualId ? 'Cambiar docente' : 'Asignar',
  );

  countLabel = computed(() => {
    const n = this.docentesFiltrados().length;
    const word = n === 1 ? 'docente' : 'docentes';
    return this.searchQuery
      ? `${n} ${word} encontrado${n === 1 ? '' : 's'}`
      : `${n} ${word} disponible${n === 1 ? '' : 's'}`;
  });

  ngOnInit() {
    this.selectedId.set(this.data.docenteActualId ?? null);

    this.api
      .get<PaginatedResponse<Docente>>('admin/users/docentes')
      .subscribe({
        next: (r) => {
          // Backend: { success, data: { data: [...], total, page, limit, totalPages } }
          // ApiService desenvuelve la 1ra capa, queda { data: [...], total, ... }
          this.docentes.set(r.data?.data ?? []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  select(id: string) {
    this.selectedId.set(this.selectedId() === id ? null : id);
  }

  clearSearch() {
    this.searchQuery = '';
  }

  submit() {
    if (!this.canSubmit()) return;
    this.dialogRef.close(this.selectedId());
  }

  cancel() {
    this.dialogRef.close(null);
  }
}
import { Component, inject, signal, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../../core/services/api';

export interface CourseParticipantsData {
  seccionId: number | string;
  cursoNombre?: string;
  seccionNombre?: string;
}

interface Participante {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  codigo_estudiante: string;
  email?: string | null;
}

@Component({
  selector: 'app-course-participants',
  standalone: true,
  imports: [
    MatDialogModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule,
  ],
  templateUrl: './course-participants.html',
  styleUrl: './course-participants.scss',
})
export class CourseParticipants implements OnInit {
  private api = inject(ApiService);
  private ref = inject<MatDialogRef<CourseParticipants>>(MatDialogRef);
  readonly data = inject<CourseParticipantsData>(MAT_DIALOG_DATA);

  loading = signal(true);
  alumnos = signal<Participante[]>([]);

  ngOnInit(): void {
    this.api.get<any[]>(`courses/seccion/${this.data.seccionId}/students`).subscribe({
      next: (r) => {
        const raw = (r.data ?? []) as any[];
        this.alumnos.set(raw.map((e) => ({
          id: e.alumno?.id ?? e.alumno_id ?? e.id,
          nombre: e.alumno?.nombre ?? e.nombre ?? '',
          apellido_paterno: e.alumno?.apellido_paterno ?? e.apellido_paterno ?? '',
          apellido_materno: e.alumno?.apellido_materno ?? e.apellido_materno,
          codigo_estudiante: e.alumno?.codigo_estudiante ?? e.codigo_estudiante ?? '',
          email: e.alumno?.email ?? e.email ?? null,
        })));
        this.loading.set(false);
      },
      error: () => { this.alumnos.set([]); this.loading.set(false); },
    });
  }

  iniciales(a: Participante): string {
    return ((a.nombre?.[0] ?? '') + (a.apellido_paterno?.[0] ?? '')).toUpperCase() || 'A';
  }

  cerrar(): void { this.ref.close(); }
}

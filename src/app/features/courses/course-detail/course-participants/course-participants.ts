import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LazyCourseStore, RosterStudent } from '../../data-access/lazy-course.store';

export interface CourseParticipantsData {
  seccionId: number | string;
  cursoNombre?: string;
  seccionNombre?: string;
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
  private store = inject(LazyCourseStore);
  private destroyRef = inject(DestroyRef);
  private ref = inject<MatDialogRef<CourseParticipants>>(MatDialogRef);
  readonly data = inject<CourseParticipantsData>(MAT_DIALOG_DATA);

  loading = signal(true);
  alumnos = signal<RosterStudent[]>([]);

  ngOnInit(): void {
    // Comparte el cache de roster con tab-asistencia y otros consumidores
    // que abren el curso simultáneamente (1 fetch en lugar de 3-4).
    this.store.roster$(String(this.data.seccionId))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.alumnos.set(list);
          this.loading.set(false);
        },
        error: () => { this.alumnos.set([]); this.loading.set(false); },
      });
  }

  iniciales(a: RosterStudent): string {
    return ((a.nombre?.[0] ?? '') + (a.apellido_paterno?.[0] ?? '')).toUpperCase() || 'A';
  }

  cerrar(): void { this.ref.close(); }
}

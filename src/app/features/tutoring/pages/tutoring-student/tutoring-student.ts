import {
  Component, ChangeDetectionStrategy, inject, computed, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { TutoringStore } from '../../data-access/tutoring.store';
import type { AlumnoTutoria } from '../../data-access/tutoring.types';

@Component({
  selector: 'app-tutoring-student',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatChipsModule, MatFormFieldModule, MatInputModule,
    MatIconModule, MatButtonModule, MatProgressBarModule,
  ],
  templateUrl: './tutoring-student.html',
  styleUrl: './tutoring-student.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TutoringStudent {
  readonly store = inject(TutoringStore);

  readonly search = signal('');

  readonly alumnosFiltrados = computed(() => {
    const list = this.store.data()?.alumnos ?? [];
    const q = this.search().trim().toLowerCase();
    if (!q) return list;
    return list.filter(a =>
      `${a.nombre} ${a.apellido_paterno} ${a.apellido_materno ?? ''} ${a.codigo_estudiante}`
        .toLowerCase()
        .includes(q),
    );
  });

  initials(a: AlumnoTutoria): string {
    return `${(a.nombre[0] ?? '')}${(a.apellido_paterno[0] ?? '')}`.toUpperCase();
  }

  progresoAlumno(a: AlumnoTutoria): number {
    const total = this.store.bimestresHasta();
    if (total === 0) return 0;
    return Math.round((a.libretas.length / total) * 100);
  }

  isCompleto(a: AlumnoTutoria): boolean {
    const total = this.store.bimestresHasta();
    return total > 0 && a.libretas.length === total;
  }
}
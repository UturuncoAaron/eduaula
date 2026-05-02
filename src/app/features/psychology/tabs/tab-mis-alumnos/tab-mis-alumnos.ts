import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { PsychologyStore } from '../../stores/psychology.store';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { AssignedStudent } from '../../../../core/models/psychology';

@Component({
  selector: 'app-tab-mis-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule,
    EmptyState,
  ],
  templateUrl: './tab-mis-alumnos.html',
  styleUrl: './tab-mis-alumnos.scss',
})
export class TabMisAlumnos implements OnInit {
  readonly store = inject(PsychologyStore);
  private router = inject(Router);

  readonly query = signal('');

  readonly filteredStudents = computed<AssignedStudent[]>(() => {
    const term = this.query().trim().toLowerCase();
    const all = this.store.myStudents();
    if (!term) return all;
    return all.filter(s =>
      [s.nombre, s.apellido_paterno, s.apellido_materno ?? '', s.codigo_estudiante]
        .join(' ').toLowerCase().includes(term),
    );
  });

  ngOnInit(): void {
    // Siempre recarga al entrar — cada navegación trae datos frescos
    this.store.loadMyStudents();
  }

  onSearch(value: string) { this.query.set(value); }

  initials(s: AssignedStudent): string {
    return ((s.nombre?.[0] ?? '') + (s.apellido_paterno?.[0] ?? '')).toUpperCase();
  }

  fullName(s: AssignedStudent): string {
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  verFicha(s: AssignedStudent) {
    this.router.navigate(['/dashboard/psicologa/fichas', s.id]);
  }
}
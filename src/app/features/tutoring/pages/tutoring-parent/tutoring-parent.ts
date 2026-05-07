import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TutoringStore } from '../../data-access/tutoring.store';
import type { AlumnoTutoria, PadreTutoria } from '../../data-access/tutoring.types';

const RELACION_LABELS: Readonly<Record<string, string>> = {
  padre:     'Padre',
  madre:     'Madre',
  tutor:     'Tutor legal',
  apoderado: 'Apoderado',
};

@Component({
  selector: 'app-tutoring-parent',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatChipsModule, MatTooltipModule],
  templateUrl: './tutoring-parent.html',
  styleUrl: './tutoring-parent.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TutoringParent {
  readonly store = inject(TutoringStore);

  readonly padres = computed<PadreTutoria[]>(() => this.store.data()?.padres ?? []);

  readonly alumnosById = computed<Map<string, AlumnoTutoria>>(() => {
    const list = this.store.data()?.alumnos ?? [];
    return new Map(list.map((a) => [a.id, a]));
  });

  trackById = (_: number, p: PadreTutoria): string => p.id;

  relacionLabel(r: string): string {
    return RELACION_LABELS[r] ?? r;
  }

  initials(p: PadreTutoria): string {
    return `${p.nombre[0] ?? ''}${p.apellido_paterno[0] ?? ''}`.toUpperCase();
  }

  fullName(p: PadreTutoria): string {
    return [p.apellido_paterno, p.apellido_materno].filter((s) => !!s).join(' ');
  }

  nombresHijos(p: PadreTutoria): string[] {
    const map = this.alumnosById();
    return p.hijos_ids
      .map((id) => map.get(id))
      .filter((x): x is AlumnoTutoria => !!x)
      .map((a) => `${a.nombre} ${a.apellido_paterno}`);
  }

  hasContact(p: PadreTutoria): boolean {
    return Boolean(p.email) || Boolean(p.telefono);
  }
}
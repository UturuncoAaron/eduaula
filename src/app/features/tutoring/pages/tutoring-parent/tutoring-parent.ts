import {
  Component, ChangeDetectionStrategy, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

import { TutoringStore } from '../../data-access/tutoring.store';
import type { PadreTutoria } from '../../data-access/tutoring.types';

@Component({
  selector: 'app-tutoring-parent',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatChipsModule],
  templateUrl: './tutoring-parent.html',
  styleUrl: './tutoring-parent.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TutoringParent {
  readonly store = inject(TutoringStore);

  relacionLabel(r: string): string {
    const m: Record<string, string> = {
      padre: 'Padre', madre: 'Madre',
      tutor: 'Tutor legal', apoderado: 'Apoderado',
    };
    return m[r] ?? r;
  }

  initials(p: PadreTutoria): string {
    return `${(p.nombre[0] ?? '')}${(p.apellido_paterno[0] ?? '')}`.toUpperCase();
  }

  nombresHijos(p: PadreTutoria): string[] {
    const alumnos = this.store.data()?.alumnos ?? [];
    return p.hijos_ids
      .map(id => alumnos.find(a => a.id === id))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map(a => `${a.nombre} ${a.apellido_paterno}`);
  }
}
import {
  ChangeDetectionStrategy, Component, OnInit, inject, signal,
} from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';

import { PsychologyStore } from '../data-access/psychology.store';
import { ApiService } from '../../../core/services/api';
import {
  InformePsicologico, INFORME_TIPO_LABELS, AssignedStudent, ParentOfStudent,
} from '../../../core/models/psychology';

/**
 * Vista de impresión de un informe psicológico.
 *
 * Diseño:
 *   • Render HTML "tipo documento" — A4-friendly, blanco/negro,
 *     tipografía serif clásica de informe institucional.
 *   • Toolbar superior con botón "Imprimir / Guardar como PDF" que
 *     usa `window.print()` (el browser ofrece "Save as PDF" en el
 *     diálogo). No requiere lib backend → cero overhead para 600
 *     alumnos/año.
 *   • `@media print` oculta toolbar y deja sólo el documento.
 *
 * Datos: el informe + ficha del alumno + lista de padres (para
 * derivaciones a familia se muestran nombres y DNIs como destinatarios).
 */
@Component({
  selector: 'app-informe-print',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, TitleCasePipe,
    RouterLink, RouterLinkActive,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './informe-print.html',
  styleUrl: './informe-print.scss',
})
export class InformePrint implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(PsychologyStore);
  private api = inject(ApiService);

  readonly informe = signal<InformePsicologico | null>(null);
  readonly student = signal<AssignedStudent | null>(null);
  readonly parents = signal<ParentOfStudent[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly tipoLabels = INFORME_TIPO_LABELS;

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Informe no encontrado');
      this.loading.set(false);
      return;
    }
    try {
      const informe = await this.store.getInformeById(id);
      this.informe.set(informe);
      // Cargar alumno y padres en paralelo. Si falla algo, mostramos
      // lo que tengamos (no bloqueamos el render).
      const [stuRes, parents] = await Promise.allSettled([
        firstValueFrom(
          this.api.get<AssignedStudent>(`users/alumnos/${informe.studentId}`),
        ),
        this.store.getStudentParents(informe.studentId),
      ]);
      if (stuRes.status === 'fulfilled') {
        this.student.set(stuRes.value.data ?? null);
      }
      if (parents.status === 'fulfilled') {
        this.parents.set(parents.value);
      }
    } catch {
      this.error.set('No se pudo cargar el informe');
    } finally {
      this.loading.set(false);
    }
  }

  studentFullName(s: AssignedStudent | null): string {
    if (!s) return '—';
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  parentFullName(p: ParentOfStudent): string {
    return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim();
  }

  print() {
    window.print();
  }
}

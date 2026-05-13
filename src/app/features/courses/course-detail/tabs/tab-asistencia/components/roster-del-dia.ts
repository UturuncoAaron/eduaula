import {
  ChangeDetectionStrategy, Component, computed, input, model, output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ESTADOS, EstadoAsistencia, RosterRow } from '../asistencia.types';

/**
 * Vista del docente para marcar la asistencia de UN día.
 * - Selector de fecha (two-way con `date`).
 * - Toolbar con "Todos presentes" / "Todos ausentes" y "Guardar (N)".
 * - Chips de resumen.
 * - Lista de roster con pills por estado + observación opcional.
 */
@Component({
  selector: 'app-roster-del-dia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './roster-del-dia.html',
  styleUrl: './roster-del-dia.scss',
})
export class RosterDelDia {
  /** Roster del día actual (con `dirty` flag por fila). */
  readonly roster = input.required<RosterRow[]>();
  /** Si el viewer puede editar (sólo docente). */
  readonly canEdit = input.required<boolean>();
  /** Indicador de guardado en curso. */
  readonly saving = input.required<boolean>();
  /** Fecha (YYYY-MM-DD) seleccionada — two-way binding con el parent. */
  readonly date = model.required<string>();

  /** Eventos de mutación: el parent es el dueño del estado. */
  readonly setEstado = output<{ alumnoId: string; estado: EstadoAsistencia }>();
  readonly setObs = output<{ alumnoId: string; valor: string }>();
  readonly marcarTodos = output<EstadoAsistencia>();
  readonly save = output<void>();

  readonly estados = ESTADOS;

  readonly dirtyCount = computed(() =>
    this.roster().filter(r => r.dirty && r.estado != null).length,
  );

  readonly canSave = computed(() => this.dirtyCount() > 0 && !this.saving());

  readonly resumen = computed(() => {
    const r = this.roster();
    return {
      total: r.length,
      presente: r.filter(x => x.estado === 'presente').length,
      ausente:  r.filter(x => x.estado === 'ausente').length,
      tardanza: r.filter(x => x.estado === 'tardanza').length,
      sin_marcar: r.filter(x => x.estado === null).length,
    };
  });

  onObsChange(alumnoId: string, ev: Event): void {
    const valor = (ev.target as HTMLInputElement).value;
    this.setObs.emit({ alumnoId, valor });
  }
}

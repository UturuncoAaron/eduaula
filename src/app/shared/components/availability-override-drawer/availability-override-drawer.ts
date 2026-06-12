import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';

import { AppointmentsStore } from '../../../features/appointments/data-access/appointments.store';
import { parseApiError } from '../../utils/api-errors';
import { toHHMM, toMin } from '../week-grid/week-grid.types';
import type { AppointmentRoleRule } from '../../../core/models/appointments';

export interface OverrideDrawerData {
  cuentaId: string;
  date: string;
  dateLabel: string;
  baseSlots: { horaInicio: string; horaFin: string }[];
  currentOverrides: { id: string; horaInicio: string; horaFin: string }[];
  isBlocked: boolean;
  rule: AppointmentRoleRule | null;
}

export interface OverrideDrawerResult {
  action: 'saved' | 'deleted' | 'cancelled';
  cancelledCount?: number;
}

interface SlotDraft {
  horaInicio: string;
  horaFin: string;
  error: string | null;
}

/** Normaliza HH:MM:SS → HH:MM para compatibilidad con input[type=time] y el DTO. */
function normalizeHHMM(value: string): string {
  if (!value) return '';
  const parts = value.split(':');
  if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  return value;
}

@Component({
  selector: 'app-availability-override-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './availability-override-drawer.html',
  styleUrl: './availability-override-drawer.scss',
})
export class AvailabilityOverrideDrawer {
  readonly data = inject<OverrideDrawerData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<AvailabilityOverrideDrawer, OverrideDrawerResult>);
  private readonly store = inject(AppointmentsStore);
  private readonly toast = inject(ToastService);

  readonly saving = signal(false);

  readonly mode = signal<'base' | 'custom' | 'blocked'>(
    this.data.isBlocked
      ? 'blocked'
      : this.data.currentOverrides.length > 0
        ? 'custom'
        : 'base',
  );

  readonly slots = signal<SlotDraft[]>(
    this.data.currentOverrides.length > 0
      ? this.data.currentOverrides.map(s => ({
        horaInicio: normalizeHHMM(s.horaInicio),
        horaFin: normalizeHHMM(s.horaFin),
        error: null,
      }))
      : this.data.baseSlots.map(s => ({
        horaInicio: normalizeHHMM(s.horaInicio),
        horaFin: normalizeHHMM(s.horaFin),
        error: null,
      })),
  );

  readonly step = computed(() => this.data.rule?.slotMinutes ?? 30);

  readonly hasSlotErrors = computed(() => this.slots().some(s => s.error !== null));

  readonly isBaseMode = computed(() => this.mode() === 'base');
  readonly isCustomMode = computed(() => this.mode() === 'custom');
  readonly isBlockedMode = computed(() => this.mode() === 'blocked');

  /** Suma las horas totales de los slots válidos del draft. */
  readonly totalHours = computed(() => {
    if (this.mode() !== 'custom') return 0;
    return this.slots().reduce((acc, s) => {
      if (s.error) return acc;
      return acc + (toMin(s.horaFin) - toMin(s.horaInicio));
    }, 0) / 60;
  });

  setModeBase(): void { this.mode.set('base'); }

  setModeCustom(): void {
    this.mode.set('custom');
    if (this.slots().length === 0) {
      this.slots.set(
        this.data.baseSlots.map(s => ({
          horaInicio: normalizeHHMM(s.horaInicio),
          horaFin: normalizeHHMM(s.horaFin),
          error: null,
        })),
      );
    }
  }

  setModeBlocked(): void { this.mode.set('blocked'); }

  /** Agrega un slot nuevo al final del draft con hora calculada desde el último. */
  addSlot(): void {
    const last = this.slots()[this.slots().length - 1];
    const start = last ? toMin(normalizeHHMM(last.horaFin)) : 8 * 60;
    const end = start + this.step();
    this.slots.update(list => [
      ...list,
      { horaInicio: toHHMM(start), horaFin: toHHMM(end), error: null },
    ]);
  }

  /** Elimina un slot del draft por índice. */
  removeSlot(index: number): void {
    this.slots.update(list => list.filter((_, i) => i !== index));
  }

  /** Actualiza la hora de inicio de un slot y revalida. */
  updateSlotStart(index: number, value: string): void {
    this.slots.update(list =>
      list.map((s, i) => {
        if (i !== index) return s;
        const error = this.validateSlot(value, s.horaFin);
        return { ...s, horaInicio: value, error };
      }),
    );
  }

  /** Actualiza la hora de fin de un slot y revalida. */
  updateSlotEnd(index: number, value: string): void {
    this.slots.update(list =>
      list.map((s, i) => {
        if (i !== index) return s;
        const error = this.validateSlot(s.horaInicio, value);
        return { ...s, horaFin: value, error };
      }),
    );
  }

  /** Valida que inicio y fin sean correctos y que fin sea posterior a inicio. */
  private validateSlot(inicio: string, fin: string): string | null {
    if (!inicio || !fin) return 'Completa ambos campos';
    if (toMin(fin) <= toMin(inicio)) return 'La hora de fin debe ser posterior al inicio';
    return null;
  }

  /** Guarda el override o elimina si el modo es base. */
  async save(): Promise<void> {
    if (this.saving()) return;

    if (this.mode() === 'base') {
      this.saving.set(true);
      try {
        await this.store.deleteOverrideForDate(this.data.cuentaId, this.data.date);
        this.toast.success('Restablecido al horario base');
        this.ref.close({ action: 'deleted' });
      } catch (err) {
        this.toast.error(parseApiError(err, 'No se pudo restablecer'), 'Error');
      } finally {
        this.saving.set(false);
      }
      return;
    }

    let slotsToSend: { horaInicio: string; horaFin: string }[] = [];

    if (this.mode() === 'custom') {
      const validated = this.slots().map(s => ({
        ...s,
        error: this.validateSlot(s.horaInicio, s.horaFin),
      }));
      this.slots.set(validated);
      if (validated.some(s => s.error)) return;
      slotsToSend = validated.map(s => ({
        horaInicio: normalizeHHMM(s.horaInicio),
        horaFin: normalizeHHMM(s.horaFin),
      }));
    }

    this.saving.set(true);
    try {
      const result = await this.store.replaceOverridesForDate(
        this.data.cuentaId,
        this.data.date,
        slotsToSend,
      );
      const cancelled = result.cancelledAppointments?.length ?? 0;
      if (cancelled > 0) {
        this.toast.info(
          `Disponibilidad guardada — ${cancelled} cita${cancelled > 1 ? 's' : ''} cancelada${cancelled > 1 ? 's' : ''} automáticamente`,
          undefined,
          { duration: 6000 },
        );
      } else {
        this.toast.success('Disponibilidad del día guardada');
      }
      this.ref.close({ action: 'saved', cancelledCount: cancelled });
    } catch (err) {
      this.toast.error(parseApiError(err, 'No se pudo guardar'), 'Error');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { this.ref.close({ action: 'cancelled' }); }
}
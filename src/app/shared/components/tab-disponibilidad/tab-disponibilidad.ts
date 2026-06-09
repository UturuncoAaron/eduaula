import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ToastService } from 'ngx-toastr-notifier';
import { firstValueFrom } from 'rxjs';

import {
  AvailabilityCalendarEditor,
} from '../availability-calendar-editor/availability-calendar-editor';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import {
  SlotCascadeConfirmDialog, SlotCascadeDialogData,
} from '../../../features/appointments/dialogs/slot-cascade-confirm-dialog/slot-cascade-confirm-dialog';
import { AppointmentsStore } from '../../../features/appointments/data-access/appointments.store';
import { AuthService } from '../../../core/auth/auth';
import {
  AccountAvailability, SetAvailabilityPayload,
  ruleForRol,
} from '../../../core/models/appointments';
import { parseApiError } from '../../utils/api-errors';

@Component({
  selector: 'app-tab-disponibilidad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatDialogModule,
    AvailabilityCalendarEditor,
  ],
  templateUrl: './tab-disponibilidad.html',
  styleUrl: './tab-disponibilidad.scss',
})
export class TabDisponibilidad implements OnInit {
  readonly store = inject(AppointmentsStore);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);

  // ── Estado ───────────────────────────────────────────────────
  readonly saving = signal(false);
  readonly myRule = computed(() => {
    const me = this.auth.currentUser();
    return me ? ruleForRol(me.rol) : null;
  });

  // ── Modo estático (weekly recurrente) ────────────────────────
  readonly availability = computed(() => this.store.availability());

  async ngOnInit(): Promise<void> {
    const me = this.auth.currentUser();
    if (me) {
      await this.store.loadAvailability(me.id);
    }
  }

  // ── Guardar disponibilidad estática ──────────────────────────
  async onSave(items: SetAvailabilityPayload[]): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) return;

    const count = await this.store.countFutureAppointments();
    if (count > 0) {
      const ok = await firstValueFrom(
        this.dialog.open(ConfirmDialog, {
          width: '420px',
          data: {
            title: '¿Actualizar horario base?',
            message: `Tienes ${count} cita${count > 1 ? 's' : ''} programada${count > 1 ? 's' : ''} que ya no encajarán en el nuevo horario y se cancelarán automáticamente. Los participantes serán notificados.`,
            confirm: 'Sí, actualizar',
            cancel: 'Cancelar',
            danger: true,
          },
        }).afterClosed(),
      );
      if (!ok) return;
    }

    // Modo estático: no enviar tipo (el backend asume 'weekly' por defecto).
    // Compatibilidad hacia atrás con versiones anteriores del backend.
    const weeklyItems: SetAvailabilityPayload[] = items.map(({ diaSemana, horaInicio, horaFin }) => ({
      diaSemana, horaInicio, horaFin,
    }));

    this.saving.set(true);
    try {
      await this.store.replaceMyAvailability(weeklyItems);
      await Promise.all([
        this.store.loadAvailability(me.id),
        this.store.loadMyAppointments(),
      ]);
      this.toast.success('Horario base guardado');
    } catch (err) {
      this.toast.error(parseApiError(err, 'No se pudo guardar'), 'Error');
    } finally {
      this.saving.set(false);
    }
  }

  // ── Eliminar bloque ───────────────────────────────────────────
  async onDeleteSlot(av: AccountAvailability): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) return;

    this.saving.set(true);
    try {
      const first = await this.store.deleteAvailabilitySlot(av.id, false);
      if (first && 'statusCode' in first && first.statusCode === 409) {
        const data: SlotCascadeDialogData = {
          slotLabel: `${this.diaLabel(av.diaSemana)} ${av.horaInicio} – ${av.horaFin}`,
          affected: first.affected,
        };
        const ok = await firstValueFrom(
          this.dialog.open<SlotCascadeConfirmDialog, SlotCascadeDialogData, boolean>(
            SlotCascadeConfirmDialog,
            { data, width: '560px', maxWidth: '95vw' },
          ).afterClosed(),
        );
        if (!ok) return;
        const retry = await this.store.deleteAvailabilitySlot(av.id, true);
        if (retry && 'statusCode' in retry) {
          this.toast.error('No se pudo eliminar el bloque ni siquiera con cascada', 'Error');
          return;
        }
        await Promise.all([
          this.store.loadAvailability(me.id),
          this.store.loadMyAppointments(),
        ]);
        this.toast.success('Bloque eliminado — citas afectadas canceladas', 'OK');
        return;
      }
      await Promise.all([
        this.store.loadAvailability(me.id),
        this.store.loadMyAppointments(),
      ]);
      this.toast.success('Bloque eliminado', 'OK');
    } catch (err) {
      this.toast.error(parseApiError(err, 'No se pudo eliminar el bloque'), 'Error');
    } finally {
      this.saving.set(false);
    }
  }

  private diaLabel(d: AccountAvailability['diaSemana']): string {
    const m: Record<string, string> = {
      lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
      jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado',
    };
    return m[d] ?? d;
  }
}

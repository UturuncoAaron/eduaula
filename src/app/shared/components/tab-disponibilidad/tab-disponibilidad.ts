import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ToastService } from 'ngx-toastr-notifier';

import { AvailabilityCalendarEditor } from '../availability-calendar-editor/availability-calendar-editor';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { AppointmentsStore } from '../../../features/appointments/data-access/appointments.store';
import { AuthService } from '../../../core/auth/auth';
import { SetAvailabilityPayload, ruleForRol } from '../../../core/models/appointments';
import { parseApiError } from '../../utils/api-errors';

@Component({
  selector: 'app-tab-disponibilidad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressSpinnerModule, MatDialogModule, AvailabilityCalendarEditor],
  templateUrl: './tab-disponibilidad.html',
  styleUrl: './tab-disponibilidad.scss',
})
export class TabDisponibilidad implements OnInit {
  readonly store = inject(AppointmentsStore);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);

  readonly saving = signal(false);
  readonly availability = computed(() => this.store.availability());
  readonly myRule = computed(() => {
    const me = this.auth.currentUser();
    return me ? ruleForRol(me.rol, me.cargo) : null;
  });

  async ngOnInit(): Promise<void> {
    const me = this.auth.currentUser();
    if (me) await this.store.loadAvailability(me.id);
  }

  async onSave(items: SetAvailabilityPayload[]): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) return;

    const count = await this.store.countFutureAppointments();
    if (count > 0) {
      const ok = await this.dialog.open(ConfirmDialog, {
        width: '420px',
        data: {
          title: '¿Actualizar disponibilidad?',
          message: `Tienes ${count} cita${count > 1 ? 's' : ''} programada${count > 1 ? 's' : ''} que ya no encajarán en el nuevo horario y se cancelarán automáticamente. Los participantes serán notificados.`,
          confirm: 'Sí, actualizar',
          cancel: 'Cancelar',
          danger: true,
        },
      }).afterClosed().toPromise();
      if (!ok) return;
    }

    this.saving.set(true);
    try {
      await this.store.replaceMyAvailability(items);
      await this.store.loadAvailability(me.id);
      this.toast.success('Disponibilidad actualizada');
    } catch (err) {
      this.toast.error(parseApiError(err, 'No se pudo guardar'), 'Error');
    } finally {
      this.saving.set(false);
    }
  }
}
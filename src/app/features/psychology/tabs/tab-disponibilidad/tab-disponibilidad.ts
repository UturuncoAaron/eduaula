import {
  ChangeDetectionStrategy, Component, OnInit, computed, inject, signal,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';

import {
  AvailabilityCalendarEditor,
} from '../../../../shared/components/availability-calendar-editor/availability-calendar-editor';
import { AppointmentsStore } from '../../../appointments/data-access/appointments.store';
import { AuthService } from '../../../../core/auth/auth';
import { SetAvailabilityPayload } from '../../../../core/models/appointments';
import { parseApiError } from '../../../../shared/utils/api-errors';

@Component({
  selector: 'app-tab-disponibilidad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatProgressSpinnerModule,
    AvailabilityCalendarEditor,
  ],
  templateUrl: './tab-disponibilidad.html',
  styleUrl: './tab-disponibilidad.scss',
})
export class TabDisponibilidad implements OnInit {
  readonly store = inject(AppointmentsStore);
  private auth = inject(AuthService);
  private toastr = inject(ToastService);

  readonly saving = signal(false);

  /** Disponibilidad actual del usuario (signal del store, expuesta para el template). */
  readonly availability = computed(() => this.store.availability());

  async ngOnInit(): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) return;
    await this.store.loadAvailability(me.id);
  }

  async onSave(items: SetAvailabilityPayload[]): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) return;

    this.saving.set(true);
    try {
      await this.store.replaceMyAvailability(items);
      await this.store.loadAvailability(me.id);
      this.toastr.success('Disponibilidad actualizada');
    } catch (err: unknown) {
      this.toastr.error(parseApiError(err, 'No se pudo guardar la disponibilidad'), 'Error');
    } finally {
      this.saving.set(false);
    }
  }
}
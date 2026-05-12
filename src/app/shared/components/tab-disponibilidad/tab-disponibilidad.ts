import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';

import { AvailabilityCalendarEditor } from '../availability-calendar-editor/availability-calendar-editor';
import { AppointmentsStore } from '../../../features/appointments/data-access/appointments.store';
import { AuthService } from '../../../core/auth/auth';
import {
  SetAvailabilityPayload, ruleForRol,
} from '../../../core/models/appointments';
import { parseApiError } from '../../utils/api-errors';

@Component({
  selector: 'app-tab-disponibilidad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressSpinnerModule, MatIconModule, AvailabilityCalendarEditor],
  template: `
    <div class="tab-disp">
      @if (store.loadingAvailability()) {
        <div class="state-center">
          <mat-spinner diameter="32" />
          <span>Cargando disponibilidad…</span>
        </div>
      } @else {
        <app-availability-calendar-editor
          [initial]="availability()"
          [rule]="myRule()"
          [saving]="saving()"
          (save)="onSave($event)" />
      }
    </div>
  `,
  styles: [`
    .tab-disp     { display: flex; flex-direction: column; gap: 20px; }
    .state-center { display: flex; align-items: center; gap: 12px;
                    padding: 40px; color: #64748b; }
  `],
})
export class TabDisponibilidad implements OnInit {
  readonly store = inject(AppointmentsStore);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  readonly saving = signal(false);
  readonly availability = computed(() => this.store.availability());

  /**
   * Regla del rol del usuario actual. El editor la usa para limitar
   * horas, días permitidos y paso del grid (ej.: director 15min mar/jue,
   * psicóloga 30min L-V 08-16, docente 45min L-V 08-15:30).
   */
  readonly myRule = computed(() => {
    const me = this.auth.currentUser();
    if (!me) return null;
    return ruleForRol(me.rol, me.cargo);
  });

  async ngOnInit(): Promise<void> {
    const me = this.auth.currentUser();
    if (me) await this.store.loadAvailability(me.id);
  }

  async onSave(items: SetAvailabilityPayload[]): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) return;
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

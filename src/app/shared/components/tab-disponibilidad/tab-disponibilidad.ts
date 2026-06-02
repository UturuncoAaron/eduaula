import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
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
  WeekAvailabilityResponse,
  type WeekAppointmentSummary,
  ruleForRol,
} from '../../../core/models/appointments';
import { parseApiError } from '../../utils/api-errors';

// ── Helpers de fecha ──────────────────────────────────────────────────
function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + delta);
  return formatDate(d);
}

function addDays(dateStr: string, days: number): string {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 1, day ?? 1);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function isoToday(): string {
  return formatDate(new Date());
}

function formatWeekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  const mon = new Date(y, (m ?? 1) - 1, d ?? 1);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${mon.toLocaleDateString('es-PE', opts)} – ${sun.toLocaleDateString('es-PE', opts)}`;
}

type DisponibilidadMode = 'static' | 'weekly';

@Component({
  selector: 'app-tab-disponibilidad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DatePipe,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatTooltipModule,
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

  // ── Modo ─────────────────────────────────────────────────────
  readonly mode = signal<DisponibilidadMode>('static');

  // ── Compartido ───────────────────────────────────────────────
  readonly saving = signal(false);
  readonly myRule = computed(() => {
    const me = this.auth.currentUser();
    return me ? ruleForRol(me.rol) : null;
  });

  // ── Modo estático (weekly recurrente) ────────────────────────
  readonly availability = computed(() => this.store.availability());

  // ── Modo semanal ─────────────────────────────────────────────
  readonly weekStart = signal(getMondayOf(new Date()));
  readonly loadingWeek = signal(false);
  readonly weekData = signal<WeekAvailabilityResponse | null>(null);

  /** Bloques activos de la semana (específicos + semanales filtrados). */
  readonly weekBlocks = computed<AccountAvailability[]>(() => {
    const d = this.weekData();
    if (!d) return [];
    return [...d.specificBlocks, ...d.weeklyBlocks];
  });

  /** Citas de seguimiento de la semana actual, para mostrar en el editor. */
  readonly weekFollowUps = computed<WeekAppointmentSummary[]>(() =>
    (this.weekData()?.appointments ?? []).filter(a => a.isFollowUp),
  );

  /** Etiqueta de la semana visible. */
  readonly weekLabel = computed(() => formatWeekLabel(this.weekStart()));

  /** True si la semana visible ya pasó (solo lectura, modo auditoría). */
  readonly isPastWeek = computed(() => {
    const today = isoToday();
    const sunday = addDays(this.weekStart(), 6);
    return sunday < today;
  });

  async ngOnInit(): Promise<void> {
    const me = this.auth.currentUser();
    if (me) {
      await this.store.loadAvailability(me.id);
    }
  }

  // ── Cambiar modo ─────────────────────────────────────────────
  async setMode(m: DisponibilidadMode): Promise<void> {
    this.mode.set(m);
    if (m === 'weekly') {
      await this.loadWeekData();
    }
  }

  // ── Navegación de semana ─────────────────────────────────────
  async prevWeek(): Promise<void> {
    this.weekStart.set(addDays(this.weekStart(), -7));
    await this.loadWeekData();
  }

  async nextWeek(): Promise<void> {
    this.weekStart.set(addDays(this.weekStart(), 7));
    await this.loadWeekData();
  }

  async goToCurrentWeek(): Promise<void> {
    this.weekStart.set(getMondayOf(new Date()));
    await this.loadWeekData();
  }

  private async loadWeekData(): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) return;
    this.loadingWeek.set(true);
    try {
      const data = await this.store.getWeekAvailability(me.id, this.weekStart());
      this.weekData.set(data);
    } finally {
      this.loadingWeek.set(false);
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
            title: '¿Actualizar disponibilidad?',
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
      this.toast.success('Disponibilidad semanal guardada');
    } catch (err) {
      this.toast.error(parseApiError(err, 'No se pudo guardar'), 'Error');
    } finally {
      this.saving.set(false);
    }
  }

  // ── Guardar disponibilidad específica de esta semana ─────────
  async onSaveWeek(items: SetAvailabilityPayload[]): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) return;

    // Convertir cada bloque a specific con fecha concreta
    const ws = this.weekStart();
    const dayOffsets: Record<string, number> = {
      lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5,
    };
    const specificItems: SetAvailabilityPayload[] = items.map(i => ({
      ...i,
      tipo: 'specific' as const,
      fechaEspecifica: addDays(ws, dayOffsets[i.diaSemana] ?? 0),
    }));

    this.saving.set(true);
    try {
      await this.store.saveWeekAvailability(specificItems);
      await this.loadWeekData();
      this.toast.success(`Disponibilidad de la semana ${this.weekLabel()} guardada`);
    } catch (err) {
      this.toast.error(parseApiError(err, 'No se pudo guardar la semana'), 'Error');
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
          this.mode() === 'weekly' ? this.loadWeekData() : Promise.resolve(),
        ]);
        this.toast.success('Bloque eliminado — citas afectadas canceladas', 'OK');
        return;
      }
      await Promise.all([
        this.store.loadAvailability(me.id),
        this.mode() === 'weekly' ? this.loadWeekData() : Promise.resolve(),
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

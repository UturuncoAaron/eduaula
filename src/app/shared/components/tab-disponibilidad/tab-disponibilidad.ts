import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';

import {
  AvailabilityCalendarEditor,
} from '../availability-calendar-editor/availability-calendar-editor';
import {
  AvailabilityOverrideDrawer,
  OverrideDrawerData,
  OverrideDrawerResult,
} from '../availability-override-drawer/availability-override-drawer';
import { AppointmentsStore } from '../../../features/appointments/data-access/appointments.store';
import { AuthService } from '../../../core/auth/auth';
import {
  AccountAvailability,
  SetAvailabilityPayload,
  AvailabilityOverrideDay,
  DiaSemana,
  ruleForRol,
} from '../../../core/models/appointments';
import { parseApiError } from '../../utils/api-errors';
import { addDays, getMondayOf } from '../week-grid/week-grid.types';
import { firstValueFrom } from 'rxjs';

const DIA_LABELS: Record<DiaSemana, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
};

const DIAS_SEMANA: DiaSemana[] = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes',
];


interface WeekDayCard {
  date: string;         // YYYY-MM-DD
  dateLabel: string;    // "Lun 16"
  diaSemana: DiaSemana;
  /** 'base' | 'custom' | 'blocked' */
  status: 'base' | 'custom' | 'blocked';
  /** Slots efectivos del día (base o override) */
  slots: { horaInicio: string; horaFin: string }[];
  /** Overrides guardados con id */
  overrides: { id: string; horaInicio: string; horaFin: string }[];
  /** Slots del horario base para este día */
  baseSlots: { horaInicio: string; horaFin: string }[];
  isPast: boolean;
}

@Component({
  selector: 'app-tab-disponibilidad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    AvailabilityCalendarEditor,
  ],
  templateUrl: './tab-disponibilidad.html',
  styleUrl: './tab-disponibilidad.scss',
})
export class TabDisponibilidad implements OnInit {
  readonly store = inject(AppointmentsStore);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  readonly saving = signal(false);
  readonly loadingOverrides = signal(false);
  readonly weekStart = signal<string>(getMondayOf(new Date()));

  readonly myRule = computed(() => {
    const me = this.auth.currentUser();
    return me ? ruleForRol(me.rol) : null;
  });

  readonly availability = computed(() => this.store.availability());

  // ── Overrides de la semana visible ───────────────────────
  readonly overrides = signal<AvailabilityOverrideDay[]>([]);

  /** Tarjetas lun–vie para la semana visible */
  readonly weekCards = computed<WeekDayCard[]>(() => {
    const monday = this.weekStart();
    const av = this.availability();
    const overridesByDate = new Map<string, AvailabilityOverrideDay>(
      this.overrides().map(o => [o.date, o]),
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return DIAS_SEMANA.map((dia, i) => {
      const date = addDays(monday, i);
      const d = new Date(`${date}T00:00:00`);
      const dateLabel = d.toLocaleDateString('es-PE', {
        weekday: 'short', day: '2-digit', month: 'short',
      });

      // Slots del horario base para este día de la semana
      const baseSlots = av
        .filter(a => a.diaSemana === dia && a.activo)
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
        .map(a => ({ horaInicio: a.horaInicio, horaFin: a.horaFin }));

      const override = overridesByDate.get(date);
      const isPast = d < today;

      if (!override) {
        return {
          date, dateLabel, diaSemana: dia,
          status: 'base' as const,
          slots: baseSlots,
          overrides: [],
          baseSlots,
          isPast,
        };
      }

      const isBlocked = override.slots.length === 0;
      return {
        date, dateLabel, diaSemana: dia,
        status: isBlocked ? 'blocked' as const : 'custom' as const,
        slots: override.slots.map(s => ({ horaInicio: s.horaInicio, horaFin: s.horaFin })),
        overrides: override.slots,
        baseSlots,
        isPast,
      };
    });
  });

  readonly weekRangeLabel = computed(() => {
    const monday = this.weekStart();
    const friday = addDays(monday, 4);
    const fmt = (d: string) =>
      new Date(`${d}T00:00:00`).toLocaleDateString('es-PE', {
        day: '2-digit', month: 'short',
      });
    return `${fmt(monday)} – ${fmt(friday)}`;
  });

  readonly isCurrentWeek = computed(() => {
    return this.weekStart() === getMondayOf(new Date());
  });

  // ── Ciclo de vida ─────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) return;
    await Promise.all([
      this.store.loadAvailability(me.id),
      this.loadOverrides(),
    ]);
  }

  // ── Navegación de semana ──────────────────────────────────
  async prevWeek(): Promise<void> {
    this.weekStart.set(addDays(this.weekStart(), -7));
    await this.loadOverrides();
  }

  async nextWeek(): Promise<void> {
    this.weekStart.set(addDays(this.weekStart(), 7));
    await this.loadOverrides();
  }

  async goToCurrentWeek(): Promise<void> {
    this.weekStart.set(getMondayOf(new Date()));
    await this.loadOverrides();
  }

  // ── Cargar overrides ──────────────────────────────────────
  private async loadOverrides(): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) return;
    this.loadingOverrides.set(true);
    try {
      const result = await this.store.getOverridesForWeek(me.id, this.weekStart());
      this.overrides.set(result);
    } catch {
      this.overrides.set([]);
    } finally {
      this.loadingOverrides.set(false);
    }
  }

  // ── Guardar horario base ──────────────────────────────────
  async onSave(items: SetAvailabilityPayload[]): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) return;

    this.saving.set(true);
    try {
      await this.store.replaceMyAvailability(items);
      await this.store.loadAvailability(me.id);
      this.toast.success('Horario base guardado');
    } catch (err) {
      this.toast.error(parseApiError(err, 'No se pudo guardar'), 'Error');
    } finally {
      this.saving.set(false);
    }
  }

  // ── Abrir drawer de override ──────────────────────────────
  async openOverrideDrawer(card: WeekDayCard): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) return;

    const data: OverrideDrawerData = {
      cuentaId: me.id,
      date: card.date,
      dateLabel: card.dateLabel,
      baseSlots: card.baseSlots,
      currentOverrides: card.overrides,
      isBlocked: card.status === 'blocked',
      rule: this.myRule(),
    };

    const ref = this.dialog.open<
      AvailabilityOverrideDrawer,
      OverrideDrawerData,
      OverrideDrawerResult
    >(AvailabilityOverrideDrawer, {
      data,
      width: '440px',
      maxWidth: '96vw',
      height: '100vh',
      position: { right: '0', top: '0' },
      panelClass: 'form-drawer-pane',
      autoFocus: false,
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (result && result.action !== 'cancelled') {
      await this.loadOverrides();
    }
  }

  // ── Eliminar bloque del base ──────────────────────────────
  async onDeleteSlot(av: AccountAvailability): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) return;

    this.saving.set(true);
    try {
      const first = await this.store.deleteAvailabilitySlot(av.id, false);
      if (first && 'statusCode' in first && first.statusCode === 409) {
        const { SlotCascadeConfirmDialog } = await import(
          '../../../features/appointments/dialogs/slot-cascade-confirm-dialog/slot-cascade-confirm-dialog'
        );
        const ok = await firstValueFrom(
          this.dialog.open(SlotCascadeConfirmDialog, {
            data: {
              slotLabel: `${DIA_LABELS[av.diaSemana]} ${av.horaInicio} – ${av.horaFin}`,
              affected: first.affected,
            },
            width: '560px',
            maxWidth: '95vw',
          }).afterClosed(),
        );
        if (!ok) return;
        await this.store.deleteAvailabilitySlot(av.id, true);
        this.toast.success('Bloque eliminado — citas afectadas canceladas');
      } else {
        this.toast.success('Bloque eliminado');
      }
      await this.store.loadAvailability(me.id);
    } catch (err) {
      this.toast.error(parseApiError(err, 'No se pudo eliminar el bloque'), 'Error');
    } finally {
      this.saving.set(false);
    }
  }

  // ── Helpers de template ───────────────────────────────────
  statusLabel(status: WeekDayCard['status']): string {
    if (status === 'blocked') return 'Bloqueado';
    if (status === 'custom') return 'Modificado';
    return 'Horario base';
  }

  statusIcon(status: WeekDayCard['status']): string {
    if (status === 'blocked') return 'block';
    if (status === 'custom') return 'edit_calendar';
    return 'repeat';
  }
}
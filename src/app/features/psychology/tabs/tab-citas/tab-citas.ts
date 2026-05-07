import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PsychologyStore } from '../../data-access/psychology.store';
import {
  Appointment,
  AppointmentEstado,
} from '../../../../core/models/psychology';

import { EmptyState } from '../../../../shared/components/empty-state/empty-state';

import {
  AppointmentFormDialog,
  AppointmentFormDialogData,
} from '../../dialogs/appointment-form-dialog/appointment-form-dialog';

import { ConfirmDialog, ConfirmData } from '../../../../shared/components/confirm-dialog/confirm-dialog';

type EstadoFilter = AppointmentEstado | 'all';
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'past';

interface EstadoOption { value: EstadoFilter; label: string; }
interface DateOption   { value: DateFilter;   label: string; }

interface StudentLike {
  // camelCase
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  // snake_case (tu modelo real)
  nombre?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
}

@Component({
  selector: 'app-tab-citas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    EmptyState,
  ],
  templateUrl: './tab-citas.html',
  styleUrls: ['./tab-citas.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabCitas {
  protected readonly store = inject(PsychologyStore);
  private readonly dialog = inject(MatDialog);
  private readonly snack  = inject(MatSnackBar);

  readonly filterEstado = signal<EstadoFilter>('all');
  readonly filterDate   = signal<DateFilter>('all');
  readonly search       = signal('');

  readonly displayedColumns = ['fecha', 'alumno', 'tipo', 'modalidad', 'duracion', 'estado', 'acciones'];
  readonly dataSource = new MatTableDataSource<Appointment>([]);
  readonly paginator = viewChild<MatPaginator>(MatPaginator);
  readonly sort      = viewChild<MatSort>(MatSort);

  readonly estados: EstadoOption[] = [
    { value: 'all',        label: 'Todos los estados' },
    { value: 'pendiente',  label: 'Pendiente' },
    { value: 'confirmada', label: 'Confirmada' },
    { value: 'realizada',  label: 'Realizada' },
    { value: 'cancelada',  label: 'Cancelada' },
    { value: 'no_asistio', label: 'No asistió' },
  ];

  readonly fechas: DateOption[] = [
    { value: 'all',   label: 'Todas las fechas' },
    { value: 'today', label: 'Hoy' },
    { value: 'week',  label: 'Esta semana' },
    { value: 'month', label: 'Este mes' },
    { value: 'past',  label: 'Anteriores' },
  ];

  readonly visible = computed<Appointment[]>(() => {
    const all = this.store.appointments();
    const estado = this.filterEstado();
    const dateFilter = this.filterDate();
    const term = this.search().trim().toLowerCase();
    const now = new Date();

    return all.filter((a: Appointment) => {
      if (estado !== 'all' && a.estado !== estado) return false;

      if (dateFilter !== 'all') {
        const d = new Date(a.scheduledAt);
        if (dateFilter === 'today') {
          if (d.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'week') {
          const start = startOfWeek(now);
          const end = new Date(start);
          end.setDate(start.getDate() + 7);
          if (d < start || d >= end) return false;
        } else if (dateFilter === 'month') {
          if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
        } else if (dateFilter === 'past') {
          if (d >= now) return false;
        }
      }

      if (term && !this.studentName(a).toLowerCase().includes(term)) return false;
      return true;
    });
  });

  readonly stats = computed(() => {
    const all = this.store.appointments();
    const now = new Date();
    const today = now.toDateString();
    return {
      total: all.length,
      pendientes: all.filter((a: Appointment) => a.estado === 'pendiente').length,
      hoy: all.filter((a: Appointment) => new Date(a.scheduledAt).toDateString() === today).length,
      proximas: all.filter((a: Appointment) =>
        new Date(a.scheduledAt) > now &&
        (a.estado === 'pendiente' || a.estado === 'confirmada'),
      ).length,
    };
  });

  constructor() {
    void this.store.loadMyAppointments();

    effect(() => {
      this.dataSource.data = this.visible();
    });

    effect(() => {
      const paginator = this.paginator();
      const sort = this.sort();
      if (paginator && this.dataSource.paginator !== paginator) {
        this.dataSource.paginator = paginator;
      }
      if (sort && this.dataSource.sort !== sort) {
        this.dataSource.sort = sort;
      }
    });
  }

  onEstadoChange(v: EstadoFilter): void { this.filterEstado.set(v); }
  onFechaChange(v: DateFilter): void    { this.filterDate.set(v); }
  onSearchChange(v: string): void       { this.search.set(v); }

  clearFilters(): void {
    this.filterEstado.set('all');
    this.filterDate.set('all');
    this.search.set('');
  }

  studentName(a: Appointment): string {
    const obj = a as unknown as Record<string, unknown>;
    const candidate = (obj['student'] ?? obj['alumno']) as StudentLike | undefined;
    if (!candidate) return '—';
    const nom = candidate.nombre ?? candidate.nombres;
    const ap  = candidate.apellido_paterno ?? candidate.apellidoPaterno;
    const am  = candidate.apellido_materno ?? candidate.apellidoMaterno;
    const parts = [nom, ap, am].filter((x): x is string => typeof x === 'string' && x.length > 0);
    return parts.join(' ').trim() || '—';
  }

  estadoLabel(estado: AppointmentEstado): string {
    return this.estados.find((e: EstadoOption) => e.value === estado)?.label ?? estado;
  }

  canConfirm(a: Appointment): boolean    { return a.estado === 'pendiente'; }
  canFinish(a: Appointment): boolean     { return a.estado === 'confirmada' || a.estado === 'pendiente'; }
  canMarkNoShow(a: Appointment): boolean { return a.estado !== 'cancelada' && a.estado !== 'realizada'; }
  canCancel(a: Appointment): boolean     { return a.estado !== 'cancelada' && a.estado !== 'realizada'; }

  trackById = (_: number, a: Appointment): string => a.id;

  openCreate(): void {
    const ref = this.dialog.open<
      AppointmentFormDialog,
      AppointmentFormDialogData,
      boolean
    >(AppointmentFormDialog, {
      width: '560px',
      maxWidth: '95vw',
      autoFocus: 'first-tabbable',
      data: {},
    });

    ref.afterClosed().subscribe((ok) => {
      if (ok) {
        void this.store.loadMyAppointments();
      }
    });
  }

  async setEstado(row: Appointment, estado: AppointmentEstado): Promise<void> {
    if (row.estado === estado) return;
    try {
      await this.store.updateAppointment(row.id, { estado });
      this.snack.open(`Marcada como ${this.estadoLabel(estado).toLowerCase()}`, 'OK', { duration: 2500 });
    } catch {
      this.snack.open('No se pudo actualizar el estado', 'OK', { duration: 4000 });
    }
  }

  async cancelar(row: Appointment): Promise<void> {
    const ref = this.dialog.open<ConfirmDialog, ConfirmData, boolean>(
      ConfirmDialog,
      {
        width: '420px',
        maxWidth: '95vw',
        data: {
          title: 'Cancelar cita',
          message: '¿Estás segura de cancelar esta cita? Esta acción no se puede deshacer.',
          confirm: 'Sí, cancelar',
          cancel: 'Volver',
          danger: true,
        },
      },
    );

    const ok = await firstValueFrom(ref.afterClosed());
    if (!ok) return;

    await this.setEstado(row, 'cancelada');
  }
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - day);
  return r;
}
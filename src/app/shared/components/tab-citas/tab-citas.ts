import {
  ChangeDetectionStrategy, Component, computed,
  effect, inject, signal, viewChild,
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
import { MatChipsModule } from '@angular/material/chips';

import { AppointmentsStore } from '../../../features/appointments/data-access/appointments.store';
import { AuthService } from '../.././../core/auth/auth';
import { Appointment, AppointmentEstado } from '../../../core/models/appointments';
import { EmptyState } from '../empty-state/empty-state';
import { ConfirmDialog, ConfirmData } from '../confirm-dialog/confirm-dialog';

type EstadoFilter = AppointmentEstado | 'all';
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'past';

interface EstadoOption { value: EstadoFilter; label: string; }
interface DateOption { value: DateFilter; label: string; }

function startOfWeek(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay()); return r;
}

@Component({
  selector: 'app-tab-citas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatDialogModule, MatDividerModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule,
    MatPaginatorModule, MatProgressSpinnerModule, MatSelectModule,
    MatSnackBarModule, MatSortModule, MatTableModule, MatTooltipModule,
    MatChipsModule,
    EmptyState,
  ],
  templateUrl: './tab-citas.html',
  styleUrl: './tab-citas.scss',
})
export class TabCitas {
  protected readonly apptStore = inject(AppointmentsStore);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  // ── Rol del usuario logueado ─────────────────────────────────
  readonly rol = computed(() => this.auth.currentUser()?.rol ?? '');

  readonly esPsicologa = computed(() => this.rol() === 'psicologa');
  readonly esDocente = computed(() => this.rol() === 'docente');
  readonly esPadre = computed(() => this.rol() === 'padre');
  readonly esAlumno = computed(() => this.rol() === 'alumno');

  // Puede crear citas propias (psicóloga y docente)
  readonly puedeCrear = computed(() => this.esPsicologa() || this.esDocente());
  // Confirma cuando es convocado (padre o alumno o docente recibiendo solicitud)
  readonly puedeConfirmarEntrante = computed(() =>
    this.esPadre() || this.esAlumno() || this.esDocente(),
  );

  // ── Filtros ──────────────────────────────────────────────────
  readonly filterEstado = signal<EstadoFilter>('all');
  readonly filterDate = signal<DateFilter>('all');
  readonly search = signal('');

  readonly estados: EstadoOption[] = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'confirmada', label: 'Confirmada' },
    { value: 'realizada', label: 'Realizada' },
    { value: 'cancelada', label: 'Cancelada' },
    { value: 'no_asistio', label: 'No asistió' },
  ];

  readonly fechas: DateOption[] = [
    { value: 'all', label: 'Todas las fechas' },
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mes' },
    { value: 'past', label: 'Anteriores' },
  ];

  // ── Tabla ────────────────────────────────────────────────────
  readonly displayedColumns = [
    'fecha', 'participante', 'tipo', 'modalidad', 'duracion', 'estado', 'acciones',
  ];
  readonly dataSource = new MatTableDataSource<Appointment>([]);
  readonly paginator = viewChild<MatPaginator>(MatPaginator);
  readonly sort = viewChild<MatSort>(MatSort);

  // ── Citas filtradas ──────────────────────────────────────────
  readonly visible = computed<Appointment[]>(() => {
    const all = this.apptStore.appointments();
    const estado = this.filterEstado();
    const dateFilter = this.filterDate();
    const term = this.search().trim().toLowerCase();
    const now = new Date();

    return all.filter(a => {
      if (estado !== 'all' && a.estado !== estado) return false;

      if (dateFilter !== 'all') {
        const d = new Date(a.scheduledAt);
        if (dateFilter === 'today') {
          if (d.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'week') {
          const start = startOfWeek(now);
          const end = new Date(start); end.setDate(start.getDate() + 7);
          if (d < start || d >= end) return false;
        } else if (dateFilter === 'month') {
          if (d.getMonth() !== now.getMonth() ||
            d.getFullYear() !== now.getFullYear()) return false;
        } else if (dateFilter === 'past') {
          if (d >= now) return false;
        }
      }

      if (term && !this.participantLabel(a).toLowerCase().includes(term) &&
        !this.studentLabel(a).toLowerCase().includes(term)) return false;
      return true;
    });
  });

  readonly stats = computed(() => {
    const all = this.apptStore.appointments();
    const now = new Date();
    return {
      total: all.length,
      pendientes: all.filter(a => a.estado === 'pendiente').length,
      hoy: all.filter(a =>
        new Date(a.scheduledAt).toDateString() === now.toDateString()).length,
      proximas: all.filter(a =>
        new Date(a.scheduledAt) > now &&
        (a.estado === 'pendiente' || a.estado === 'confirmada')).length,
    };
  });

  constructor() {
    void this.apptStore.loadMyAppointments();
    effect(() => { this.dataSource.data = this.visible(); });
    effect(() => {
      const p = this.paginator(); const s = this.sort();
      if (p && this.dataSource.paginator !== p) this.dataSource.paginator = p;
      if (s && this.dataSource.sort !== s) this.dataSource.sort = s;
    });
  }

  // ── Helpers de etiqueta ──────────────────────────────────────

  // La "otra parte" de la cita — depende del rol
  participantLabel(a: Appointment): string {
    const me = this.auth.currentUser()?.id;
    // Si el usuario actual es el convocador → mostrar a quién convocó
    if (a.createdById === me) {
      const p = a.convocadoA;
      if (!p) return '—';
      return `${p.nombre ?? ''} ${p.apellido_paterno ?? ''}`.trim();
    }
    // Si fue convocado → mostrar quién convocó
    const c = a.convocadoPor;
    if (!c) return '—';
    return `${c.nombre ?? ''} ${c.apellido_paterno ?? ''}`.trim();
  }

  studentLabel(a: Appointment): string {
    const s = a.student;
    if (!s) return '—';
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  estadoLabel(estado: AppointmentEstado): string {
    return this.estados.find(e => e.value === estado)?.label ?? estado;
  }

  estadoColor(estado: AppointmentEstado): string {
    const map: Record<string, string> = {
      pendiente: 'accent',
      confirmada: 'primary',
      cancelada: 'warn',
      realizada: '',
      no_asistio: 'warn',
    };
    return map[estado] ?? '';
  }

  // ── Permisos de acción ───────────────────────────────────────
  // Padre/alumno confirman cuando son el convocado
  esSoyConvocado(a: Appointment): boolean {
    return a.convocadoAId === this.auth.currentUser()?.id;
  }

  canConfirm(a: Appointment): boolean {
    if (a.estado !== 'pendiente') return false;
    // Psicóloga/docente confirman cualquiera
    if (this.esPsicologa() || this.esDocente()) return true;
    // Padre/alumno solo si son el convocado
    return this.esSoyConvocado(a);
  }

  canFinish(a: Appointment): boolean {
    return (this.esPsicologa() || this.esDocente()) &&
      (a.estado === 'confirmada' || a.estado === 'pendiente');
  }

  canMarkNoShow(a: Appointment): boolean {
    return (this.esPsicologa() || this.esDocente()) &&
      a.estado !== 'cancelada' && a.estado !== 'realizada';
  }

  canCancel(a: Appointment): boolean {
    return a.estado !== 'cancelada' && a.estado !== 'realizada';
  }

  trackById = (_: number, a: Appointment): string => a.id;

  // ── Acciones ─────────────────────────────────────────────────
  onEstadoChange(v: EstadoFilter): void { this.filterEstado.set(v); }
  onFechaChange(v: DateFilter): void { this.filterDate.set(v); }
  onSearchChange(v: string): void { this.search.set(v); }
  clearFilters(): void {
    this.filterEstado.set('all'); this.filterDate.set('all'); this.search.set('');
  }

  async openCreate(): Promise<void> {
    if (this.esPsicologa()) {
      const { AppointmentFormDialog } = await import(
        '../../../features/psychology/dialogs/appointment-form-dialog/appointment-form-dialog'
      );
      const ref = this.dialog.open(AppointmentFormDialog, {
        width: '720px', maxWidth: '95vw', data: {},
      });
      ref.afterClosed().subscribe(ok => {
        if (ok) void this.apptStore.loadMyAppointments();
      });
    } else if (this.esDocente()) {
      const { TeacherRequestAppointmentDialog } = await import(
        '../../../features/appointments/dialogs/teacher-request-appointment-dialog/teacher-request-appointment-dialog'
      );
      const ref = this.dialog.open(TeacherRequestAppointmentDialog, { width: '540px' });
      ref.afterClosed().subscribe(ok => {
        if (ok) void this.apptStore.loadMyAppointments();
      });
    } else {
      // padre / alumno → RequestAppointmentDialog con calendario
      const { RequestAppointmentDialog } = await import(
        '../../../features/appointments/dialogs/request-appointment-dialog/request-appointment-dialog'
      );
      const ref = this.dialog.open(RequestAppointmentDialog, {
        width: '720px', maxWidth: '95vw',
      });
      ref.afterClosed().subscribe(ok => {
        if (ok) void this.apptStore.loadMyAppointments();
      });
    }
  }

  async setEstado(row: Appointment, estado: AppointmentEstado): Promise<void> {
    if (row.estado === estado) return;
    try {
      await this.apptStore.updateAppointment(row.id, { estado });
      this.snack.open(
        `Marcada como ${this.estadoLabel(estado).toLowerCase()}`, 'OK',
        { duration: 2500 },
      );
    } catch {
      this.snack.open('No se pudo actualizar el estado', 'OK', { duration: 4000 });
    }
  }

  async cancelar(row: Appointment): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog.open<ConfirmDialog, ConfirmData, boolean>(ConfirmDialog, {
        width: '420px',
        data: {
          title: 'Cancelar cita',
          message: '¿Cancelar esta cita? Esta acción no se puede deshacer.',
          confirm: 'Sí, cancelar',
          cancel: 'Volver',
          danger: true,
        },
      }).afterClosed(),
    );
    if (!ok) return;
    await this.setEstado(row, 'cancelada');
  }
}
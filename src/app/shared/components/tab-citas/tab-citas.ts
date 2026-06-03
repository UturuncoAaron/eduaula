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
import { ToastService } from 'ngx-toastr-notifier';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';

import { AppointmentsStore } from '../../../features/appointments/data-access/appointments.store';
import { AuthService } from '../.././../core/auth/auth';
import {
  Appointment, AppointmentEstado, hasAvailability,
} from '../../../core/models/appointments';
import { EmptyState } from '../empty-state/empty-state';
import { ConfirmDialog, ConfirmData } from '../confirm-dialog/confirm-dialog';
import {
  RejectDialog, RejectDialogData, RejectDialogResult,
} from '../reject-dialog/reject-dialog';
import { AppointmentFormDialogData } from '../../../features/psychology/dialogs/appointment-form-dialog/appointment-form-dialog';
import {
  PostponeAppointmentDialog, PostponeDialogData, PostponeDialogResult,
} from '../../../features/appointments/dialogs/postpone-appointment-dialog/postpone-appointment-dialog';
import {
  RealizarAppointmentDialog, RealizarDialogData, RealizarDialogResult,
} from '../../../features/appointments/dialogs/realizar-appointment-dialog/realizar-appointment-dialog';
import {
  CloseSessionDialog, CloseSessionDialogData,
} from '../../../features/appointments/dialogs/close-session-dialog/close-session-dialog';
import type { CloseSessionPayload } from '../../../core/models/appointments';
import {
  AppointmentHistoryDialog, AppointmentHistoryDialogData,
} from '../../../features/appointments/dialogs/appointment-history-dialog/appointment-history-dialog';
import { parseApiError } from '../../utils/api-errors';

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
    MatSortModule, MatTableModule, MatTooltipModule,
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
  private readonly toastr = inject(ToastService);

  // ── Rol del usuario logueado ─────────────────────────────────
  readonly rol = computed(() => this.auth.currentUser()?.rol ?? '');

  readonly esPsicologa = computed(() => this.rol() === 'psicologa');
  readonly esDocente = computed(() => this.rol() === 'docente');
  readonly esAdmin = computed(() => this.rol() === 'admin');
  readonly esPadre = computed(() => this.rol() === 'padre');
  readonly esAlumno = computed(() => this.rol() === 'alumno');

  readonly puedeCrear = computed(() => hasAvailability(this.rol()));
  readonly esConvocadoSinCalendario = computed(
    () => this.esPadre() || this.esAlumno(),
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
    { value: 'rechazada', label: 'Rechazada' },
    { value: 'no_asistio', label: 'No asistio' },
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

      if (term &&
        !this.participantLabel(a).toLowerCase().includes(term) &&
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
  participantLabel(a: Appointment): string {
    const me = this.auth.currentUser()?.id;

    // Vista del alumno sobre una derivación: la cita la creó el docente,
    // pero el "profesional a cargo" debe ser la psicóloga (convocadoA),
    // no el docente que la derivó.
    if (this.esAlumno() && this.isDerivacionParaAlumno(a)) {
      const p = a.convocadoA;
      if (!p) return '—';
      return `${p.nombre ?? ''} ${p.apellido_paterno ?? ''}`.trim();
    }

    if (a.createdById === me) {
      const p = a.convocadoA;
      if (!p) return '—';
      return `${p.nombre ?? ''} ${p.apellido_paterno ?? ''}`.trim();
    }
    const c = a.convocadoPor;
    if (!c) return '—';
    return `${c.nombre ?? ''} ${c.apellido_paterno ?? ''}`.trim();
  }

  /** True si la cita es una derivación de docente→psicóloga y yo soy el alumno. */
  isDerivacionParaAlumno(a: Appointment): boolean {
    if (!this.esAlumno()) return false;
    return a.tipo === 'psicologico' && !!a.convocadoPor && a.convocadoPor.rol === 'docente';
  }

  /** Etiqueta del docente que derivó al alumno — para la sublínea "Derivado por: …". */
  derivadoPorLabel(a: Appointment): string {
    const d = a.convocadoPor;
    if (!d) return '';
    return `${d.nombre ?? ''} ${d.apellido_paterno ?? ''}`.trim();
  }

  studentLabel(a: Appointment): string {
    const s = a.student;
    if (!s) return '—';
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  showStudentSubline(a: Appointment): boolean {
    if (!a.student) return false;
    if (this.esPadre() || this.esAlumno()) return false;
    return this.studentLabel(a) !== this.participantLabel(a);
  }

  estadoLabel(estado: AppointmentEstado): string {
    return this.estados.find(e => e.value === estado)?.label ?? estado;
  }

  estadoColor(estado: AppointmentEstado): string {
    const map: Record<string, string> = {
      pendiente: 'accent', confirmada: 'primary',
      cancelada: 'warn', rechazada: 'warn',
      realizada: '', no_asistio: 'warn',
    };
    return map[estado] ?? '';
  }

  /**
   * True si la cita ya pasó en el tiempo pero sigue en un estado "vivo"
   * (pendiente o confirmada). En la vista se muestra como "Finalizada"
   * para que el usuario sepa que ya ocurrió aunque no haya sido marcada.
   */
  isFinalizada(a: Appointment): boolean {
    if (a.estado !== 'pendiente' && a.estado !== 'confirmada') return false;
    return new Date(a.scheduledAt).getTime() <= Date.now();
  }

  // ── Permisos de accion ───────────────────────────────────────
  esSoyConvocado(a: Appointment): boolean {
    return a.convocadoAId === this.auth.currentUser()?.id;
  }

  canRespond(a: Appointment): boolean {
    if (a.estado !== 'pendiente') return false;
    if (!this.esConvocadoSinCalendario()) return false; // solo padre/alumno
    const me = String(this.auth.currentUser()?.id ?? '');
    if (!me) return false;
    // Si yo convoqué la cita, espero la respuesta del otro lado.
    if (String(a.createdById) === me) return false;

    // Spec (Aarón, 2026-06): si la cita tiene un padre/tutor vinculado
    // (cita mixta o aplazada por la psicóloga), SOLO el padre confirma o
    // rechaza — nunca el alumno convocado.
    if (a.parentId) {
      return String(a.parentId) === me;
    }
    return this.esSoyConvocado(a);
  }

  /**
   * ¿La cita es una derivación docente→psicóloga emitida por *mí*?
   * Para el docente que originó la derivación, la cita es **informativa**
   * (sin estado pendiente, sin botones de acción). Spec Aarón 2026-05.
   */
  isDerivacionEmisor(a: Appointment): boolean {
    const me = this.auth.currentUser();
    if (!me) return false;
    return (
      a.tipo === 'psicologico' &&
      a.createdById === me.id &&
      this.esDocente()
    );
  }

  canConfirm(a: Appointment): boolean {
    if (a.estado !== 'pendiente') return false;

    const currentUser = this.auth.currentUser();
    if (!currentUser) return false;

    const miId = String(currentUser.id);
    const creadorId = String(a.createdById);
    const convocadoId = String(a.convocadoAId);

    // Si fui yo quien convocó, espero la respuesta del otro lado;
    // mi botón "Confirmar" debe estar oculto incluso siendo admin.
    if (creadorId === miId) return false;

    // Si yo NO soy el convocado, se oculta (salvo admin operativo
    // que actúa sobre citas en las que no es parte).
    if (currentUser.rol === 'admin' && convocadoId !== miId) return true;
    if (convocadoId !== miId) return false;

    return new Date(a.scheduledAt).getTime() > Date.now();
  }
  /** Realizar = marcar la cita como atendida. Sólo psicóloga, sobre citas vivas. */
  canFinish(a: Appointment): boolean {
    return this.esPsicologa() &&
      (a.estado === 'confirmada' || a.estado === 'pendiente');
  }

  /** No asistió = inasistencia. Sólo psicóloga, y sólo si ya pasó la hora. */
  canMarkNoShow(a: Appointment): boolean {
    if (!this.esPsicologa()) return false;
    if (a.estado === 'cancelada' || a.estado === 'rechazada' ||
      a.estado === 'realizada' || a.estado === 'no_asistio') return false;
    return new Date(a.scheduledAt).getTime() <= Date.now();
  }

  canPostpone(a: Appointment): boolean {
    // Spec (Aarón, 2026-05): el ALUMNO no puede aplazar bajo ninguna
    // circunstancia. Si necesita cambiar la cita debe cancelarla con
    // motivo y solicitar otra. El resto de roles puede aplazar.
    if (this.esAlumno()) return false;
    if (a.estado !== 'pendiente' && a.estado !== 'confirmada') return false;
    if (new Date(a.scheduledAt).getTime() <= Date.now()) return false;
    const me = this.auth.currentUser()?.id;
    const isConvocador = a.createdById === me;
    const isConvocado = a.convocadoAId === me;
    return isConvocador || isConvocado || this.esAdmin();
  }

  /** Derivar: sólo docente, acción top-level (no es por fila). */
  canDerivar(): boolean { return this.esDocente(); }

  canCancel(a: Appointment): boolean {
    return a.estado !== 'cancelada' &&
      a.estado !== 'rechazada' &&
      a.estado !== 'realizada' &&
      a.estado !== 'no_asistio';
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


        panelClass: 'afd-panel',
        autoFocus: 'first-tabbable',
        data: {} satisfies AppointmentFormDialogData,
      });
      ref.afterClosed().subscribe(ok => {
        if (ok) void this.apptStore.loadMyAppointments();
      });

    } else if (this.esDocente() || this.esAdmin()) {
      const { TeacherRequestAppointmentDialog } = await import(
        '../../../features/appointments/dialogs/teacher-request-appointment-dialog/teacher-request-appointment-dialog'
      );
      const ref = this.dialog.open(TeacherRequestAppointmentDialog, {
        width: '900px', maxWidth: '95vw',
        panelClass: 'appointment-dialog-panel',
        autoFocus: 'first-tabbable',
        data: { mode: this.esAdmin() ? 'admin' : 'docente' },
      });
      ref.afterClosed().subscribe(ok => {
        if (ok) void this.apptStore.loadMyAppointments();
      });

    } else {
      const { RequestAppointmentDialog } = await import(
        '../../../features/appointments/dialogs/request-appointment-dialog/request-appointment-dialog'
      );
      const ref = this.dialog.open(RequestAppointmentDialog, {
        width: '900px', maxWidth: '95vw',
        panelClass: 'appointment-dialog-panel',
        autoFocus: 'first-tabbable',
        data: { mode: this.esPadre() ? 'padre' : 'alumno' as const },
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
      this.toastr.success(
        `Marcada como ${this.estadoLabel(estado).toLowerCase()}`, 'OK',
        { duration: 2500 },
      );
    } catch (err: unknown) {
      this.toastr.error(
        parseApiError(err, 'No se pudo actualizar el estado'),
        'Error', { duration: 4000 },
      );
    }
  }

  async aceptar(row: Appointment): Promise<void> {
    try {
      await this.apptStore.confirmAppointment(row.id);
      this.toastr.success('Cita confirmada', 'OK', { duration: 2500 });
    } catch (err: unknown) {
      this.toastr.error(
        parseApiError(err, 'No se pudo confirmar la cita'),
        'Error', { duration: 4000 },
      );
    }
  }

  async rechazar(row: Appointment): Promise<void> {
    const data: RejectDialogData = { contextLabel: this.rejectContext(row) };
    const res = await firstValueFrom(
      this.dialog.open<RejectDialog, RejectDialogData, RejectDialogResult>(
        RejectDialog,
        { data, width: '440px', maxWidth: '95vw' },
      ).afterClosed(),
    );
    if (!res?.motivo) return;

    try {
      await this.apptStore.rejectAppointment(row.id, res.motivo);
      this.toastr.success('Cita rechazada', 'OK', { duration: 2500 });
    } catch {
      this.toastr.error('No se pudo rechazar la cita', 'OK', { duration: 4000 });
    }
  }

  private rejectContext(a: Appointment): string {
    const d = new Date(a.scheduledAt);
    const fecha = d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const con = this.participantLabel(a);
    return `${fecha} a las ${hora} con ${con}`;
  }

  async cancelar(row: Appointment): Promise<void> {
    // El BE exige motivo no vacío en PATCH /cancelar.
    const data: RejectDialogData = { contextLabel: this.rejectContext(row) };
    const res = await firstValueFrom(
      this.dialog.open<RejectDialog, RejectDialogData, RejectDialogResult>(
        RejectDialog,
        { data, width: '440px', maxWidth: '95vw' },
      ).afterClosed(),
    );
    if (!res?.motivo) return;
    try {
      await this.apptStore.cancelAppointment(row.id, { motivo: res.motivo });
      this.toastr.success('Cita cancelada', 'OK', { duration: 2500 });
    } catch (err: unknown) {
      this.toastr.error(
        parseApiError(err, 'No se pudo cancelar la cita'),
        'Error', { duration: 4000 },
      );
    }
  }

  // ── Aplazar ────────────────────────────────────────────────
  async aplazar(row: Appointment): Promise<void> {
    const ref = this.dialog.open<PostponeAppointmentDialog, PostponeDialogData, PostponeDialogResult>(
      PostponeAppointmentDialog,
      {
        width: '880px',
        maxWidth: '95vw',
        panelClass: 'appointment-dialog-panel',
        data: { appointment: row },
      },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (result?.success) {
      this.toastr.success(
        'Cita aplazada — el convocante recibirá una notificación',
        'OK', { duration: 3000 },
      );
      void this.apptStore.loadMyAppointments();
    }
  }

  // ── Realizar / Cierre clínico (psicóloga) ──────────────────
  async realizar(row: Appointment): Promise<void> {
    // La psicóloga usa el panel de Cierre Clínico (notas + seguimiento
    // automatizado). El admin conserva el cierre administrativo simple.
    if (this.esPsicologa()) {
      return this.cerrarSesionClinica(row);
    }
    const data: RealizarDialogData = { contextLabel: this.rejectContext(row) };
    const ref = this.dialog.open<RealizarAppointmentDialog, RealizarDialogData, RealizarDialogResult>(
      RealizarAppointmentDialog,
      { data, width: '480px', maxWidth: '95vw' },
    );
    const res = await firstValueFrom(ref.afterClosed());
    if (!res) return;
    try {
      await this.apptStore.markAsRealizada(row.id, {
        notasPosteriores: res.notasPosteriores,
      });
      this.toastr.success('Cita marcada como realizada', 'OK', { duration: 2500 });
    } catch (err: unknown) {
      this.toastr.error(
        parseApiError(err, 'No se pudo marcar la cita como realizada'),
        'Error', { duration: 4000 },
      );
    }
  }

  /** Panel de Cierre Clínico (slide-over) con seguimiento automatizado. */
  private async cerrarSesionClinica(row: Appointment): Promise<void> {
    const data: CloseSessionDialogData = {
      appointment: row,
      contextLabel: this.rejectContext(row),
    };
    const ref = this.dialog.open<CloseSessionDialog, CloseSessionDialogData, CloseSessionPayload>(
      CloseSessionDialog,
      {
        data,
        width: '520px',
        maxWidth: '96vw',
        height: '100vh',
        position: { right: '0', top: '0' },
        panelClass: 'form-drawer-pane',
        autoFocus: false,
      },
    );
    const payload = await firstValueFrom(ref.afterClosed());
    if (!payload) return;
    try {
      const res = await this.apptStore.closeSession(row.id, payload);
      const msg = res.followUp
        ? 'Sesión cerrada y seguimiento programado'
        : 'Sesión cerrada correctamente';
      this.toastr.success(msg, 'OK', { duration: 3000 });
    } catch (err: unknown) {
      this.toastr.error(
        parseApiError(err, 'No se pudo cerrar la sesión'),
        'Error', { duration: 4000 },
      );
    }
  }

  // ── Inasistencia (sólo psicóloga) ─────────────────────────
  async inasistencia(row: Appointment): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog.open<ConfirmDialog, ConfirmData, boolean>(ConfirmDialog, {
        width: '420px',
        data: {
          title: 'Registrar inasistencia',
          message: '¿Marcar esta cita como "no asistió"?\n\nSe notificará al padre vinculado al alumno.',
          confirm: 'Registrar inasistencia',
          cancel: 'Volver',
          danger: true,
        },
      }).afterClosed(),
    );
    if (!ok) return;
    try {
      await this.apptStore.markAsNoAsistio(row.id);
      this.toastr.success('Inasistencia registrada', 'OK', { duration: 2500 });
    } catch (err: unknown) {
      this.toastr.error(
        parseApiError(err, 'No se pudo registrar la inasistencia'),
        'Error', { duration: 4000 },
      );
    }
  }

  // ── Historial de estados ────────────────────────────────
  openHistory(row: Appointment): void {
    this.dialog.open<AppointmentHistoryDialog, AppointmentHistoryDialogData, void>(
      AppointmentHistoryDialog,
      {
        width: '560px',
        maxWidth: '95vw',
        autoFocus: 'first-tabbable',
        data: { appointment: row },
      },
    );
  }

  // ── Derivar a psicóloga (docente) ──────────────────────────
  async openDerivar(): Promise<void> {
    if (!this.canDerivar()) return;
    const mod = await import(
      '../../../features/appointments/dialogs/derive-to-psicologa-dialog/derive-to-psicologa-dialog'
    );
    type DeriveDialogT = InstanceType<typeof mod.DeriveToPsicologaDialog>;
    const ref = this.dialog.open<DeriveDialogT, void, boolean>(
      mod.DeriveToPsicologaDialog,
      {
        width: '900px',
        maxWidth: '95vw',
        // Spec (Aarón, 2026-05): el modal de derivación se estaba
        // estirando hasta ocupar todo el viewport y bloqueaba el
        // scroll. Forzamos maxHeight y permitimos que el contenido
        // scrollee dentro del dialog.
        maxHeight: '90vh',
        height: 'auto',
        panelClass: 'appointment-dialog-panel',
        autoFocus: 'first-tabbable',
      },
    );
    const ok = await firstValueFrom(ref.afterClosed());
    if (ok) {
      this.toastr.success(
        'Derivación enviada — la psicóloga será notificada',
        'OK', { duration: 3000 },
      );
      void this.apptStore.loadMyAppointments();
    }
  }
}
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
import { Appointment, AppointmentEstado, hasAvailability } from '../../../core/models/appointments';
import { EmptyState } from '../empty-state/empty-state';
import { ConfirmDialog, ConfirmData } from '../confirm-dialog/confirm-dialog';
import { RejectDialog, RejectDialogData, RejectDialogResult } from '../reject-dialog/reject-dialog';
import { AppointmentFormDialogData } from '../../../features/psychology/dialogs/appointment-form-dialog/appointment-form-dialog';
import { PostponeAppointmentDialog, PostponeDialogData, PostponeDialogResult } from '../../../features/appointments/dialogs/postpone-appointment-dialog/postpone-appointment-dialog';
import { RealizarAppointmentDialog, RealizarDialogData, RealizarDialogResult } from '../../../features/appointments/dialogs/realizar-appointment-dialog/realizar-appointment-dialog';
import { CloseSessionDialog, CloseSessionDialogData } from '../../../features/appointments/dialogs/close-session-dialog/close-session-dialog';
import type { CloseSessionPayload } from '../../../core/models/appointments';
import { AppointmentHistoryDialog, AppointmentHistoryDialogData } from '../../../features/appointments/dialogs/appointment-history-dialog/appointment-history-dialog';
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
    MatSortModule, MatTableModule, MatTooltipModule, MatChipsModule,
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

  readonly rol = computed(() => this.auth.currentUser()?.rol ?? '');
  readonly esPsicologa = computed(() => this.rol() === 'psicologa');
  readonly esDocente = computed(() => this.rol() === 'docente');
  readonly esAdmin = computed(() => this.rol() === 'admin');
  readonly esPadre = computed(() => this.rol() === 'padre');
  readonly esAlumno = computed(() => this.rol() === 'alumno');
  readonly puedeCrear = computed(() => hasAvailability(this.rol()));
  readonly esConvocadoSinCalendario = computed(() => this.esPadre() || this.esAlumno());

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

  readonly displayedColumns = ['fecha', 'participante', 'tipo', 'modalidad', 'duracion', 'estado', 'acciones'];
  readonly dataSource = new MatTableDataSource<Appointment>([]);
  readonly paginator = viewChild<MatPaginator>(MatPaginator);
  readonly sort = viewChild<MatSort>(MatSort);

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
        if (dateFilter === 'today' && d.toDateString() !== now.toDateString()) return false;
        if (dateFilter === 'week') {
          const start = startOfWeek(now);
          const end = new Date(start); end.setDate(start.getDate() + 7);
          if (d < start || d >= end) return false;
        }
        if (dateFilter === 'month' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
        if (dateFilter === 'past' && d >= now) return false;
      }
      if (term && !this.participantLabel(a).toLowerCase().includes(term) && !this.studentLabel(a).toLowerCase().includes(term)) return false;
      return true;
    });
  });

  readonly stats = computed(() => {
    const all = this.apptStore.appointments();
    const now = new Date();
    return {
      total: all.length,
      pendientes: all.filter(a => a.estado === 'pendiente').length,
      hoy: all.filter(a => new Date(a.scheduledAt).toDateString() === now.toDateString()).length,
      proximas: all.filter(a => new Date(a.scheduledAt) > now && (a.estado === 'pendiente' || a.estado === 'confirmada')).length,
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

  // Nombre del participante opuesto al usuario logueado
  participantLabel(a: Appointment): string {
    const me = this.auth.currentUser()?.id;
    if (this.esAlumno() && this.isDerivacionParaAlumno(a)) {
      const p = a.convocadoA;
      return p ? `${p.nombre ?? ''} ${p.apellido_paterno ?? ''}`.trim() : '—';
    }
    if (a.createdById === me) {
      const p = a.convocadoA;
      return p ? `${p.nombre ?? ''} ${p.apellido_paterno ?? ''}`.trim() : '—';
    }
    const c = a.convocadoPor;
    return c ? `${c.nombre ?? ''} ${c.apellido_paterno ?? ''}`.trim() : '—';
  }

  // True si la cita es una derivación docente→psicóloga y yo soy el alumno
  isDerivacionParaAlumno(a: Appointment): boolean {
    return this.esAlumno() && a.tipo === 'psicologico' && !!a.convocadoPor && a.convocadoPor.rol === 'docente';
  }

  // Nombre del docente que derivó al alumno
  derivadoPorLabel(a: Appointment): string {
    const d = a.convocadoPor;
    return d ? `${d.nombre ?? ''} ${d.apellido_paterno ?? ''}`.trim() : '';
  }

  // Nombre completo del alumno vinculado
  studentLabel(a: Appointment): string {
    const s = a.student;
    return s ? `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim() : '—';
  }

  // True si debe mostrarse la sublínea del alumno en la columna participante
  showStudentSubline(a: Appointment): boolean {
    if (!a.student || this.esPadre() || this.esAlumno()) return false;
    return this.studentLabel(a) !== this.participantLabel(a);
  }

  // Etiqueta legible del estado
  estadoLabel(estado: AppointmentEstado): string {
    return this.estados.find(e => e.value === estado)?.label ?? estado;
  }

  // Color Material del estado
  estadoColor(estado: AppointmentEstado): string {
    const map: Record<string, string> = { pendiente: 'accent', confirmada: 'primary', cancelada: 'warn', rechazada: 'warn', realizada: '', no_asistio: 'warn' };
    return map[estado] ?? '';
  }

  // True si la cita ya pasó pero sigue en estado vivo (se muestra como "Finalizada")
  isFinalizada(a: Appointment): boolean {
    if (a.estado !== 'pendiente' && a.estado !== 'confirmada') return false;
    return new Date(a.scheduledAt).getTime() <= Date.now();
  }

  // True si yo soy el convocado de la cita
  esSoyConvocado(a: Appointment): boolean {
    return a.convocadoAId === this.auth.currentUser()?.id;
  }

  // Siempre false — los botones inline Aceptar/Rechazar se eliminaron en favor del menú
  canRespond(_a: Appointment): boolean {
    return false;
  }

  // True si el padre puede rechazar esta cita
  canReject(a: Appointment): boolean {
    if (a.estado !== 'pendiente') return false;
    const me = this.auth.currentUser()?.id;
    if (a.lastPostponedById && String(a.lastPostponedById) === String(me)) return false;
    return a.convocadoAId === me || a.parentId === me;
  }

  // True si soy el docente que originó una derivación (cita informativa sin acciones)
  isDerivacionEmisor(a: Appointment): boolean {
    const me = this.auth.currentUser();
    if (!me) return false;
    return a.tipo === 'psicologico' && a.createdById === me.id && this.esDocente();
  }

  canConfirm(a: Appointment): boolean {
    if (a.estado !== 'pendiente') return false;
    const currentUser = this.auth.currentUser();
    if (!currentUser) return false;
    const miId = String(currentUser.id);

    if (a.lastPostponedById && String(a.lastPostponedById) === miId) return false;

    if (currentUser.rol === 'padre') {
      return a.convocadoAId === miId || a.parentId === miId;
    }

    if (currentUser.rol === 'docente') {
      return a.convocadoAId === miId;
    }

    if (currentUser.rol === 'admin') {
      return String(a.createdById) !== miId;
    }

    if (String(a.createdById) === miId) return false;
    if (a.convocadoAId !== miId) return false;
    return new Date(a.scheduledAt).getTime() > Date.now();
  }
  // True si la psicóloga puede marcar la cita como realizada (solo confirmada)
  canFinish(a: Appointment): boolean {
    if (!['pendiente', 'confirmada'].includes(a.estado)) return false;
    const me = this.auth.currentUser();
    if (!me) return false;
    if (!['psicologa', 'docente', 'admin'].includes(me.rol)) return false;
    const miId = String(me.id);
    if (me.rol === 'admin') return true;
    return a.createdById === miId || a.convocadoAId === miId;
  }


  // True si la psicóloga puede registrar inasistencia (confirmada y fecha pasada)
  canMarkNoShow(a: Appointment): boolean {
    const me = this.auth.currentUser();
    if (!me) return false;
    if (!['psicologa', 'docente', 'admin'].includes(me.rol)) return false;
    if (['cancelada', 'rechazada', 'realizada', 'no_asistio'].includes(a.estado)) return false;
    if (new Date(a.scheduledAt).getTime() > Date.now()) return false;
    if (me.rol === 'admin') return true;
    const miId = String(me.id);
    return a.createdById === miId || a.convocadoAId === miId;
  }

  // True si el usuario puede aplazar la cita
  canPostpone(a: Appointment): boolean {
    if (this.esAlumno()) return false;
    if (a.estado !== 'pendiente' && a.estado !== 'confirmada') return false;
    if (new Date(a.scheduledAt).getTime() <= Date.now()) return false;
    const me = this.auth.currentUser()?.id;
    return a.createdById === me || a.convocadoAId === me || this.esAdmin();
  }

  // True si el usuario puede cancelar esta cita
  canCancel(a: Appointment): boolean {
    return !['cancelada', 'rechazada', 'realizada', 'no_asistio'].includes(a.estado);
  }

  // True si soy docente y puedo derivar alumnos a la psicóloga
  canDerivar(): boolean { return this.esDocente(); }

  trackById = (_: number, a: Appointment): string => a.id;

  onEstadoChange(v: EstadoFilter): void { this.filterEstado.set(v); }
  onFechaChange(v: DateFilter): void { this.filterDate.set(v); }
  onSearchChange(v: string): void { this.search.set(v); }
  clearFilters(): void { this.filterEstado.set('all'); this.filterDate.set('all'); this.search.set(''); }

  async openCreate(): Promise<void> {
    if (this.esPsicologa()) {
      const { AppointmentFormDialog } = await import('../../../features/psychology/dialogs/appointment-form-dialog/appointment-form-dialog');
      const ref = this.dialog.open(AppointmentFormDialog, { panelClass: 'afd-panel', autoFocus: 'first-tabbable', data: {} satisfies AppointmentFormDialogData });
      ref.afterClosed().subscribe(ok => { if (ok) void this.apptStore.loadMyAppointments(); });
    } else if (this.esDocente() || this.esAdmin()) {
      const { TeacherRequestAppointmentDialog } = await import('../../../features/appointments/dialogs/teacher-request-appointment-dialog/teacher-request-appointment-dialog');
      const ref = this.dialog.open(TeacherRequestAppointmentDialog, { width: '900px', maxWidth: '95vw', panelClass: 'appointment-dialog-panel', autoFocus: 'first-tabbable', data: { mode: this.esAdmin() ? 'admin' : 'docente' } });
      ref.afterClosed().subscribe(ok => { if (ok) void this.apptStore.loadMyAppointments(); });
    } else {
      const { RequestAppointmentDialog } = await import('../../../features/appointments/dialogs/request-appointment-dialog/request-appointment-dialog');
      const ref = this.dialog.open(RequestAppointmentDialog, { width: '900px', maxWidth: '95vw', panelClass: 'appointment-dialog-panel', autoFocus: 'first-tabbable', data: { mode: this.esPadre() ? 'padre' : 'alumno' as const } });
      ref.afterClosed().subscribe(ok => { if (ok) void this.apptStore.loadMyAppointments(); });
    }
  }

  async setEstado(row: Appointment, estado: AppointmentEstado): Promise<void> {
    if (row.estado === estado) return;
    try {
      await this.apptStore.updateAppointment(row.id, { estado });
      this.toastr.success(`Marcada como ${this.estadoLabel(estado).toLowerCase()}`, 'OK', { duration: 2500 });
    } catch (err: unknown) {
      this.toastr.error(parseApiError(err, 'No se pudo actualizar el estado'), 'Error', { duration: 4000 });
    }
  }

  async aceptar(row: Appointment): Promise<void> {
    try {
      await this.apptStore.confirmAppointment(row.id);
      this.toastr.success('Cita confirmada', 'OK', { duration: 2500 });
    } catch (err: unknown) {
      this.toastr.error(parseApiError(err, 'No se pudo confirmar la cita'), 'Error', { duration: 4000 });
    }
  }

  async rechazar(row: Appointment): Promise<void> {
    const data: RejectDialogData = { contextLabel: this.rejectContext(row) };
    const res = await firstValueFrom(this.dialog.open<RejectDialog, RejectDialogData, RejectDialogResult>(RejectDialog, { data, width: '440px', maxWidth: '95vw' }).afterClosed());
    if (!res?.motivo) return;
    try {
      await this.apptStore.rejectAppointment(row.id, res.motivo);
      this.toastr.success('Cita rechazada', 'OK', { duration: 2500 });
    } catch {
      this.toastr.error('No se pudo rechazar la cita', 'OK', { duration: 4000 });
    }
  }

  async cancelar(row: Appointment): Promise<void> {
    const data: RejectDialogData = { contextLabel: this.rejectContext(row) };
    const res = await firstValueFrom(this.dialog.open<RejectDialog, RejectDialogData, RejectDialogResult>(RejectDialog, { data, width: '440px', maxWidth: '95vw' }).afterClosed());
    if (!res?.motivo) return;
    try {
      await this.apptStore.cancelAppointment(row.id, { motivo: res.motivo });
      this.toastr.success('Cita cancelada', 'OK', { duration: 2500 });
    } catch (err: unknown) {
      this.toastr.error(parseApiError(err, 'No se pudo cancelar la cita'), 'Error', { duration: 4000 });
    }
  }

  async aplazar(row: Appointment): Promise<void> {
    const ref = this.dialog.open<PostponeAppointmentDialog, PostponeDialogData, PostponeDialogResult>(PostponeAppointmentDialog, { width: '880px', maxWidth: '95vw', panelClass: 'appointment-dialog-panel', data: { appointment: row } });
    const result = await firstValueFrom(ref.afterClosed());
    if (result?.success) {
      this.toastr.success('Cita aplazada — el convocante recibirá una notificación', 'OK', { duration: 3000 });
      void this.apptStore.loadMyAppointments();
    }
  }

  async realizar(row: Appointment): Promise<void> {
    if (this.esPsicologa()) return this.cerrarSesionClinica(row);
    const data: RealizarDialogData = { contextLabel: this.rejectContext(row) };
    const ref = this.dialog.open<RealizarAppointmentDialog, RealizarDialogData, RealizarDialogResult>(RealizarAppointmentDialog, { data, width: '480px', maxWidth: '95vw' });
    const res = await firstValueFrom(ref.afterClosed());
    if (!res) return;
    try {
      await this.apptStore.markAsRealizada(row.id, { notasPosteriores: res.notasPosteriores });
      this.toastr.success('Cita marcada como realizada', 'OK', { duration: 2500 });
    } catch (err: unknown) {
      this.toastr.error(parseApiError(err, 'No se pudo marcar la cita como realizada'), 'Error', { duration: 4000 });
    }
  }

  // Cierre clínico con notas y seguimiento automatizado (solo psicóloga)
  private async cerrarSesionClinica(row: Appointment): Promise<void> {
    const data: CloseSessionDialogData = { appointment: row, contextLabel: this.rejectContext(row) };
    const ref = this.dialog.open<CloseSessionDialog, CloseSessionDialogData, CloseSessionPayload>(CloseSessionDialog, { data, width: '520px', maxWidth: '96vw', height: '100vh', position: { right: '0', top: '0' }, panelClass: 'form-drawer-pane', autoFocus: false });
    const payload = await firstValueFrom(ref.afterClosed());
    if (!payload) return;
    try {
      const res = await this.apptStore.closeSession(row.id, payload);
      this.toastr.success(res.followUp ? 'Sesión cerrada y seguimiento programado' : 'Sesión cerrada correctamente', 'OK', { duration: 3000 });
    } catch (err: unknown) {
      this.toastr.error(parseApiError(err, 'No se pudo cerrar la sesión'), 'Error', { duration: 4000 });
    }
  }

  async inasistencia(row: Appointment): Promise<void> {
    const ok = await firstValueFrom(this.dialog.open<ConfirmDialog, ConfirmData, boolean>(ConfirmDialog, { width: '420px', data: { title: 'Registrar inasistencia', message: '¿Marcar esta cita como "no asistió"?\n\nSe notificará al padre vinculado al alumno.', confirm: 'Registrar inasistencia', cancel: 'Volver', danger: true } }).afterClosed());
    if (!ok) return;
    try {
      await this.apptStore.markAsNoAsistio(row.id);
      this.toastr.success('Inasistencia registrada', 'OK', { duration: 2500 });
    } catch (err: unknown) {
      this.toastr.error(parseApiError(err, 'No se pudo registrar la inasistencia'), 'Error', { duration: 4000 });
    }
  }

  openHistory(row: Appointment): void {
    this.dialog.open<AppointmentHistoryDialog, AppointmentHistoryDialogData, void>(AppointmentHistoryDialog, { width: '560px', maxWidth: '95vw', autoFocus: 'first-tabbable', data: { appointment: row } });
  }

  async openDerivar(): Promise<void> {
    if (!this.canDerivar()) return;
    const mod = await import('../../../features/appointments/dialogs/derive-to-psicologa-dialog/derive-to-psicologa-dialog');
    type DeriveDialogT = InstanceType<typeof mod.DeriveToPsicologaDialog>;
    const ref = this.dialog.open<DeriveDialogT, void, boolean>(mod.DeriveToPsicologaDialog, { width: '900px', maxWidth: '95vw', maxHeight: '90vh', height: 'auto', panelClass: 'appointment-dialog-panel', autoFocus: 'first-tabbable' });
    const ok = await firstValueFrom(ref.afterClosed());
    if (ok) {
      this.toastr.success('Derivación enviada — la psicóloga será notificada', 'OK', { duration: 3000 });
      void this.apptStore.loadMyAppointments();
    }
  }

  // Contexto legible para dialogs de rechazo/cancelación
  private rejectContext(a: Appointment): string {
    const d = new Date(a.scheduledAt);
    const fecha = d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    return `${fecha} a las ${hora} con ${this.participantLabel(a)}`;
  }
}
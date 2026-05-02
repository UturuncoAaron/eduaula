import { ChangeDetectionStrategy, Component, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from 'ngx-toastr-notifier';

import { PsychologyStore } from '../../../../../psychology/stores/psychology.store';
import { EmptyState } from '../../../../../../shared/components/empty-state/empty-state';
import { ConfirmDialog } from '../../../../../../shared/components/confirm-dialog/confirm-dialog';
import { AppointmentFormDialog } from '../../../dialogs/appointment-form-dialog/appointment-form-dialog';
import {
  Appointment, AppointmentEstado,
} from '../../../../../../core/models/psychology';

@Component({
  selector: 'app-tab-citas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule,
    MatTableModule, MatPaginatorModule, MatIconModule, MatButtonModule,
    MatMenuModule, MatChipsModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatSelectModule,
    EmptyState,
  ],
  templateUrl: './tab-citas.html',
  styleUrl: './tab-citas.scss',
})
export class TabCitas implements OnInit {
  readonly store = inject(PsychologyStore);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  readonly filterEstado = signal<AppointmentEstado | 'all'>('all');

  dataSource = new MatTableDataSource<Appointment>([]);
  displayedColumns = ['fecha', 'alumno', 'tipo', 'modalidad', 'duracion', 'estado', 'acciones'];

  readonly estados: { value: AppointmentEstado | 'all'; label: string }[] = [
    { value: 'all',         label: 'Todos los estados' },
    { value: 'pendiente',   label: 'Pendiente' },
    { value: 'confirmada',  label: 'Confirmada' },
    { value: 'realizada',   label: 'Realizada' },
    { value: 'cancelada',   label: 'Cancelada' },
    { value: 'no_asistio',  label: 'No asistió' },
  ];

  readonly visible = computed(() => {
    const all = this.store.appointments();
    const e = this.filterEstado();
    return e === 'all' ? all : all.filter(a => a.estado === e);
  });

  constructor() {
    effect(() => {
      this.dataSource.data = this.visible();
      if (this.paginator) {
        this.dataSource.paginator = this.paginator;
      }
    });
  }

  ngOnInit(): void {
    if (this.store.appointments().length === 0) {
      this.store.loadMyAppointments();
    }
  }

  onEstadoChange(value: AppointmentEstado | 'all') {
    this.filterEstado.set(value);
  }

  studentName(a: Appointment): string {
    const s = a.student;
    if (!s) return '—';
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  estadoLabel(e: AppointmentEstado): string {
    return this.estados.find(x => x.value === e)?.label ?? e;
  }

  openCreate() {
    const ref = this.dialog.open(AppointmentFormDialog, {
      width: '720px',
      data: {},
    });
    ref.afterClosed().subscribe(() => {
      // store.createAppointment ya recarga la lista
    });
  }

  async setEstado(a: Appointment, estado: AppointmentEstado) {
    try {
      await this.store.updateAppointment(a.id, { estado });
      this.toastr.success(`Cita marcada como ${this.estadoLabel(estado)}`);
    } catch {
      this.toastr.error('No se pudo actualizar la cita', 'Error');
    }
  }

  cancelar(a: Appointment) {
    const ref = this.dialog.open(ConfirmDialog, {
      width: '420px',
      data: {
        title: 'Cancelar cita',
        message: '¿Seguro que deseas cancelar esta cita?',
        confirm: 'Cancelar cita',
        cancel: 'Volver',
        danger: true,
      },
    });
    ref.afterClosed().subscribe(ok => {
      if (ok) this.setEstado(a, 'cancelada');
    });
  }
}

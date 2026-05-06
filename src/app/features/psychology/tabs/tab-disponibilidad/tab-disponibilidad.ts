import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from 'ngx-toastr-notifier';

import { AuthService } from '../../../../core/auth/auth';
import { PsychologyStore } from '../../stores/psychology.store';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { BlockFormDialog } from '../../dialogs/block-form-dialog/block-form-dialog';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import {
  PsychologistBlock, WeekDay,
} from '../../../../core/models/psychology';

interface DayRow {
  weekDay: WeekDay;
  label: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  existingId?: string;
}

@Component({
  selector: 'app-tab-disponibilidad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule,
    MatSlideToggleModule, MatProgressSpinnerModule,
    EmptyState,
  ],
  templateUrl: './tab-disponibilidad.html',
  styleUrl: './tab-disponibilidad.scss',
})
export class TabDisponibilidad implements OnInit {
  readonly store = inject(PsychologyStore);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);

  saving = signal(false);

  rows = signal<DayRow[]>([
    { weekDay: 'lunes',     label: 'Lunes',     enabled: false, startTime: '08:00', endTime: '12:00' },
    { weekDay: 'martes',    label: 'Martes',    enabled: false, startTime: '08:00', endTime: '12:00' },
    { weekDay: 'miercoles', label: 'Miércoles', enabled: false, startTime: '08:00', endTime: '12:00' },
    { weekDay: 'jueves',    label: 'Jueves',    enabled: false, startTime: '08:00', endTime: '12:00' },
    { weekDay: 'viernes',   label: 'Viernes',   enabled: false, startTime: '08:00', endTime: '12:00' },
  ]);

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (user) this.store.loadAvailability(user.id).then(() => this.hydrateRows());
    this.store.loadBlocks();
  }

  private hydrateRows() {
    const av = this.store.availability();
    const next = this.rows().map(r => {
      const found = av.find(a => a.weekDay === r.weekDay && a.activo);
      if (found) {
        return {
          ...r,
          enabled: true,
          startTime: this.toHHmm(found.startTime),
          endTime:   this.toHHmm(found.endTime),
          existingId: found.id,
        };
      }
      return { ...r, enabled: false, existingId: undefined };
    });
    this.rows.set(next);
  }

  private toHHmm(t: string): string {
    return (t || '').slice(0, 5);
  }

  toggleDay(idx: number, value: boolean) {
    const arr = [...this.rows()];
    arr[idx] = { ...arr[idx], enabled: value };
    this.rows.set(arr);
  }

  updateField(idx: number, field: 'startTime' | 'endTime', value: string) {
    const arr = [...this.rows()];
    arr[idx] = { ...arr[idx], [field]: value };
    this.rows.set(arr);
  }

  async saveAll() {
    this.saving.set(true);
    try {
      for (const row of this.rows()) {
        if (row.enabled) {
          await this.store.setAvailability({
            weekDay: row.weekDay,
            startTime: row.startTime,
            endTime: row.endTime,
          });
        } else if (row.existingId) {
          await this.store.removeAvailability(row.existingId);
        }
      }
      this.toastr.success('Disponibilidad guardada');
      const user = this.auth.currentUser();
      if (user) await this.store.loadAvailability(user.id);
      this.hydrateRows();
    } catch {
      this.toastr.error('No se pudo guardar la disponibilidad', 'Error');
    } finally {
      this.saving.set(false);
    }
  }

  // ── BLOCKS ────────────────────────────────────────────────────────────────

  openCreateBlock() {
    this.dialog.open(BlockFormDialog, {
      width: '560px',
      data: { availability: this.store.availability() },
    });
  }

  removeBlock(b: PsychologistBlock) {
    const ref = this.dialog.open(ConfirmDialog, {
      width: '420px',
      data: {
        title: 'Eliminar bloqueo',
        message: '¿Seguro que deseas eliminar este bloqueo?',
        confirm: 'Eliminar',
        cancel: 'Cancelar',
        danger: true,
      },
    });
    ref.afterClosed().subscribe(async ok => {
      if (!ok) return;
      try {
        await this.store.removeBlock(b.id);
        this.toastr.success('Bloqueo eliminado');
      } catch {
        this.toastr.error('No se pudo eliminar el bloqueo', 'Error');
      }
    });
  }
}

import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from 'ngx-toastr-notifier';

import { PsychologyStore } from '../stores/psychology.store';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { RecordFormDialog } from '../dialogs/record-form-dialog/record-form-dialog'; // ← corregido
import { AssignedStudent, PsychologyRecord } from '../../../core/models/psychology';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule,
    PageHeader, EmptyState,
  ],
  templateUrl: './student-detail.html',
  styleUrls: ['./student-detail.scss'],
})
export class StudentDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  readonly store = inject(PsychologyStore);

  readonly studentId = computed<string>(() =>
    this.route.snapshot.paramMap.get('id') ?? '',
  );

  ngOnInit(): void {
    const id = this.studentId();
    if (id) this.store.loadStudentDetailAndRecords(id);
  }

  fullName(s: AssignedStudent): string {
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  initials(s: AssignedStudent): string {
    return ((s.nombre?.[0] ?? '') + (s.apellido_paterno?.[0] ?? '')).toUpperCase();
  }

  goBack() {
    this.router.navigate(['/dashboard/psicologa/alumnos']);
  }

  openCreate() {
    const stu = this.store.currentStudent();
    if (!stu) return;
    this.dialog.open(RecordFormDialog, {
      width: '560px',
      data: { studentId: stu.id, studentName: this.fullName(stu) },
    });
  }

  openEdit(record: PsychologyRecord) {
    const stu = this.store.currentStudent();
    if (!stu) return;
    this.dialog.open(RecordFormDialog, {
      width: '560px',
      data: { studentId: stu.id, studentName: this.fullName(stu), record },
    });
  }

  delete(record: PsychologyRecord) {
    const stu = this.store.currentStudent();
    if (!stu) return;
    const ref = this.dialog.open(ConfirmDialog, {
      width: '420px',
      data: {
        title: 'Eliminar ficha',
        message: '¿Seguro que deseas eliminar esta ficha? Esta acción no se puede deshacer.',
        confirm: 'Eliminar',
        cancel: 'Cancelar',
        danger: true,
      },
    });
    ref.afterClosed().subscribe(async ok => {
      if (!ok) return;
      try {
        await this.store.deleteRecord(record.id, stu.id);
        this.toastr.success('Ficha eliminada');
      } catch {
        this.toastr.error('No se pudo eliminar la ficha', 'Error');
      }
    });
  }
}
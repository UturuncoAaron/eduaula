import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from 'ngx-toastr-notifier';

import { PsychologyStore } from '../../data-access/psychology.store';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { RecordFormDialog } from '../../dialogs/record-form-dialog/record-form-dialog';
import { AssignedStudent, PsychologyRecord, RecordCategoria } from '../../../../core/models/psychology';

@Component({
  selector: 'app-tab-fichas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule,
    MatFormFieldModule, MatSelectModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatMenuModule,
    EmptyState,
  ],
  templateUrl: './tab-fichas.html',
  styleUrl: './tab-fichas.scss',
})
export class TabFichas implements OnInit {
  readonly store = inject(PsychologyStore);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  private router = inject(Router);

  readonly selectedStudentId = signal<string | null>(null);
  readonly filterCategoria = signal<RecordCategoria | 'all'>('all');

  readonly selectedStudent = computed<AssignedStudent | null>(() => {
    const id = this.selectedStudentId();
    if (!id) return null;
    return this.store.myStudents().find(s => s.id === id) ?? null;
  });

  readonly filteredRecords = computed<PsychologyRecord[]>(() => {
    const all = this.store.currentStudentRecords();
    const cat = this.filterCategoria();
    if (cat === 'all') return all;
    return all.filter(r => r.categoria === cat);
  });

  readonly categorias: { value: RecordCategoria | 'all'; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'conductual', label: 'Conductual' },
    { value: 'academico', label: 'Académico' },
    { value: 'familiar', label: 'Familiar' },
    { value: 'emocional', label: 'Emocional' },
    { value: 'otro', label: 'Otro' },
  ];

  ngOnInit(): void {
    // Siempre recarga al entrar
    this.store.loadMyStudents();
  }

  onStudentChange(id: string) {
    this.selectedStudentId.set(id);
    this.store.loadStudentDetailAndRecords(id);
  }

  onCategoriaChange(value: RecordCategoria | 'all') {
    this.filterCategoria.set(value);
  }

  verDetalle(s: AssignedStudent) {
    this.router.navigate(['/dashboard/psicologa/fichas', s.id]);
  }

  fullName(s: AssignedStudent): string {
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  categoriaLabel(c: RecordCategoria): string {
    return this.categorias.find(x => x.value === c)?.label ?? c;
  }

  openCreate() {
    const stu = this.selectedStudent();
    if (!stu) return;
    this.dialog.open(RecordFormDialog, {
      width: '560px',
      data: { studentId: stu.id, studentName: this.fullName(stu) },
    });
  }

  openEdit(record: PsychologyRecord) {
    const stu = this.selectedStudent();
    if (!stu) return;
    this.dialog.open(RecordFormDialog, {
      width: '560px',
      data: { studentId: stu.id, studentName: this.fullName(stu), record },
    });
  }

  delete(record: PsychologyRecord) {
    const stu = this.selectedStudent();
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
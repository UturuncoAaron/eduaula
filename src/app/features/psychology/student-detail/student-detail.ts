import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from 'ngx-toastr-notifier';

import { PsychologyStore } from '../data-access/psychology.store';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { RecordFormDialog } from '../dialogs/record-form-dialog/record-form-dialog';
import { InformeFormDialog } from '../dialogs/informe-form-dialog/informe-form-dialog';
import {
  ArchivoUploadDialog, ArchivoUploadDialogData,
} from '../dialogs/archivo-upload-dialog/archivo-upload-dialog';
import {
  AssignedStudent, PsychologyRecord, InformePsicologico,
  ArchivoPsicologico, ArchivoCategoria,
  INFORME_TIPO_LABELS,
} from '../../../core/models/psychology';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule,
    PageHeader, EmptyState,
  ],
  templateUrl: './student-detail.html',
  styleUrls: ['./student-detail.scss'],
})
export class StudentDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly toastr = inject(ToastService);
  readonly store = inject(PsychologyStore);

  readonly studentId = computed<string>(
    () => this.route.snapshot.paramMap.get('id') ?? '',
  );

  readonly tipoLabels = INFORME_TIPO_LABELS;

  // ── Derivados ────────────────────────────────────────────────
  readonly fichasCount = computed(
    () => this.store.currentStudentRecords().length,
  );
  readonly informesCount = computed(
    () => this.store.currentStudentInformes().length,
  );
  readonly informesFinalizadosCount = computed(
    () => this.store.currentStudentInformes()
      .filter(i => i.estado === 'finalizado').length,
  );
  readonly fichasArchivosCount = computed(
    () => this.store.currentStudentFichas().length,
  );
  readonly testsArchivosCount = computed(
    () => this.store.currentStudentTests().length,
  );

  ngOnInit(): void {
    const id = this.studentId();
    if (!id) return;
    this.store.loadStudentDetailAndRecords(id);
    this.store.loadStudentInformes(id);
    this.store.loadStudentArchivos(id);   // ← NUEVO
  }

  // ── Identidad ────────────────────────────────────────────────
  fullName(s: AssignedStudent): string {
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  initials(s: AssignedStudent): string {
    return ((s.nombre?.[0] ?? '') + (s.apellido_paterno?.[0] ?? '')).toUpperCase();
  }

  goBack(): void {
    this.router.navigate(['/dashboard/psicologa/alumnos']);
  }

  // ── Fichas (texto) ───────────────────────────────────────────
  openCreate(): void {
    const stu = this.store.currentStudent();
    if (!stu) return;
    this.dialog.open(RecordFormDialog, {
      width: '560px',
      maxWidth: '95vw',
      data: { studentId: stu.id, studentName: this.fullName(stu) },
    });
  }

  openEdit(record: PsychologyRecord): void {
    const stu = this.store.currentStudent();
    if (!stu) return;
    this.dialog.open(RecordFormDialog, {
      width: '560px',
      maxWidth: '95vw',
      data: { studentId: stu.id, studentName: this.fullName(stu), record },
    });
  }

  delete(record: PsychologyRecord): void {
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
    ref.afterClosed().subscribe(async (ok) => {
      if (!ok) return;
      try {
        await this.store.deleteRecord(record.id, stu.id);
        this.toastr.success('Ficha eliminada');
      } catch {
        this.toastr.error('No se pudo eliminar la ficha', 'Error');
      }
    });
  }

  // ── Informes ─────────────────────────────────────────────────
  openCreateInforme(): void {
    const stu = this.store.currentStudent();
    if (!stu) return;
    this.dialog.open(InformeFormDialog, {
      width: '720px',
      maxWidth: '95vw',
      data: { studentId: stu.id, studentName: this.fullName(stu) },
    });
  }

  openEditInforme(informe: InformePsicologico): void {
    const stu = this.store.currentStudent();
    if (!stu) return;
    this.dialog.open(InformeFormDialog, {
      width: '720px',
      maxWidth: '95vw',
      data: { studentId: stu.id, studentName: this.fullName(stu), informe },
    });
  }

  finalizeInforme(informe: InformePsicologico): void {
    const stu = this.store.currentStudent();
    if (!stu) return;
    const ref = this.dialog.open(ConfirmDialog, {
      width: '460px',
      data: {
        title: 'Finalizar informe',
        message:
          'Al finalizar el informe no podrás volver a editarlo y se publicará automáticamente al portal del alumno (y del padre si no es confidencial). ¿Continuar?',
        confirm: 'Finalizar',
        cancel: 'Cancelar',
      },
    });
    ref.afterClosed().subscribe(async (ok) => {
      if (!ok) return;
      try {
        await this.store.finalizeInforme(informe.id, stu.id);
        this.toastr.success('Informe finalizado y publicado');
      } catch {
        this.toastr.error('No se pudo finalizar el informe', 'Error');
      }
    });
  }

  deleteInforme(informe: InformePsicologico): void {
    const stu = this.store.currentStudent();
    if (!stu) return;
    const ref = this.dialog.open(ConfirmDialog, {
      width: '420px',
      data: {
        title: 'Eliminar informe',
        message: '¿Seguro que deseas eliminar este informe? Esta acción no se puede deshacer.',
        confirm: 'Eliminar',
        cancel: 'Cancelar',
        danger: true,
      },
    });
    ref.afterClosed().subscribe(async (ok) => {
      if (!ok) return;
      try {
        await this.store.deleteInforme(informe.id, stu.id);
        this.toastr.success('Informe eliminado');
      } catch {
        this.toastr.error('No se pudo eliminar el informe', 'Error');
      }
    });
  }

  // ── Archivos (fichas/tests subidos) ──────────────────────────
  openUploadArchivo(categoria: ArchivoCategoria): void {
    const stu = this.store.currentStudent();
    if (!stu) return;
    const data: ArchivoUploadDialogData = {
      studentId: stu.id,
      studentName: this.fullName(stu),
      categoria,
    };
    this.dialog.open(ArchivoUploadDialog, {
      width: '600px',
      maxWidth: '95vw',
      data,
      autoFocus: false,
    });
  }

  async downloadArchivo(a: ArchivoPsicologico): Promise<void> {
    try {
      const url = await this.store.getArchivoDownloadUrl(a.id);
      window.open(url, '_blank', 'noopener');
    } catch {
      this.toastr.error('No se pudo generar el enlace de descarga', 'Error');
    }
  }

  deleteArchivo(a: ArchivoPsicologico): void {
    const stu = this.store.currentStudent();
    if (!stu) return;
    const isFicha = a.categoria === 'ficha';
    const ref = this.dialog.open(ConfirmDialog, {
      width: '440px',
      data: {
        title: isFicha ? 'Eliminar ficha' : 'Eliminar test',
        message: `¿Seguro que deseas eliminar "${a.nombre}"? El archivo se borrará del almacenamiento.`,
        confirm: 'Eliminar',
        cancel: 'Cancelar',
        danger: true,
      },
    });
    ref.afterClosed().subscribe(async (ok) => {
      if (!ok) return;
      try {
        await this.store.deleteArchivo(a.id, stu.id);
        this.toastr.success(isFicha ? 'Ficha eliminada' : 'Test eliminado');
      } catch {
        this.toastr.error('No se pudo eliminar el archivo', 'Error');
      }
    });
  }

  // ── Helpers de presentación para archivos ────────────────────
  archivoIcon(a: ArchivoPsicologico): string {
    const mime = (a.mimeType ?? '').toLowerCase();
    const ext = (a.nombreOriginal ?? '').split('.').pop()?.toLowerCase() ?? '';
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf' || ext === 'pdf') return 'picture_as_pdf';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'table_chart';
    if (['doc', 'docx'].includes(ext)) return 'description';
    if (['zip', 'rar', '7z'].includes(ext)) return 'folder_zip';
    return 'insert_drive_file';
  }

  archivoSize(a: ArchivoPsicologico): string {
    const b = a.sizeBytes ?? 0;
    if (!b) return '—';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  }
}
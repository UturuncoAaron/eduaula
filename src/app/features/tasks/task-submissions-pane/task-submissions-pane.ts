import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { ToastService } from 'ngx-toastr-notifier';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Submission, Task, tipoEntregaTarea } from '../../../core/models/task';
import { TaskService } from '../stores/task';

export interface TaskSubmissionsPaneData {
  task: Task;
}

@Component({
  selector: 'app-task-submissions-pane',
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatTooltipModule,
    MatProgressSpinnerModule, MatFormFieldModule, MatInputModule,
    MatChipsModule, MatDialogModule,
    DatePipe,
  ],
  templateUrl: './task-submissions-pane.html',
  styleUrl: './task-submissions-pane.scss',
})
export class TaskSubmissionsPane implements OnInit {
  private taskSvc = inject(TaskService);
  private toastr = inject(ToastService);
  private ref = inject<MatDialogRef<TaskSubmissionsPane>>(MatDialogRef);
  readonly data = inject<TaskSubmissionsPaneData>(MAT_DIALOG_DATA);

  loading = signal(true);
  submissions = signal<Submission[]>([]);
  saving = signal<string | null>(null);
  downloading = signal<string | null>(null);

  count = computed(() => this.submissions().length);
  esInteractiva = computed(() => tipoEntregaTarea(this.data.task) === 'interactiva');

  ngOnInit() { this.cargar(); }

  private cargar() {
    this.loading.set(true);
    this.taskSvc.getSubmissions(this.data.task.id).subscribe({
      next: r => { this.submissions.set(r.data ?? []); this.loading.set(false); },
      error: () => { this.submissions.set([]); this.loading.set(false); },
    });
  }

  nombreAlumno(sub: Submission): string {
    const a = sub.alumno;
    if (!a) return 'Alumno';
    const mat = a.apellido_materno ? ' ' + a.apellido_materno : '';
    return `${a.apellido_paterno}${mat}, ${a.nombre}`;
  }

  codigoAlumno(sub: Submission): string {
    return sub.alumno?.codigo_estudiante ?? sub.alumno_id.slice(0, 8);
  }

  esUrlExterna(key?: string | null): boolean {
    return !!key && /^https?:\/\//i.test(key);
  }

  abrirArchivo(sub: Submission) {
    if (!sub.storage_key) return;
    if (this.esUrlExterna(sub.storage_key)) {
      window.open(sub.storage_key, '_blank', 'noopener');
      return;
    }
    this.downloading.set(sub.id);
    this.taskSvc.getSubmissionFileUrl(sub.id).subscribe({
      next: r => {
        this.downloading.set(null);
        window.open(r.data.url, '_blank', 'noopener');
      },
      error: () => {
        this.downloading.set(null);
        this.toastr.success('No se pudo descargar el archivo', '…xito');
      },
    });
  }

  guardar(sub: Submission) {
    const cal = sub.calificacion_manual;
    if (cal == null || Number.isNaN(Number(cal))) {
      this.toastr.success('Ingres√° una calificaci√≥n v√°lida', '…xito');
      return;
    }
    const max = this.data.task.puntos_max;
    if (cal < 0 || cal > max) {
      this.toastr.success(`La nota debe estar entre 0 y ${max}`, '…xito');
      return;
    }
    this.saving.set(sub.id);
    this.taskSvc.gradeSubmission(sub.id, {
      calificacion_manual: cal,
      comentario_docente: sub.comentario_docente ?? null,
    }).subscribe({
      next: r => {
        const updated = r.data;
        this.submissions.update(list =>
          list.map(s => s.id === sub.id ? { ...s, ...updated } : s),
        );
        this.saving.set(null);
        this.toastr.success('Nota guardada', '…xito');
      },
      error: () => {
        this.saving.set(null);
        this.toastr.success('Error al guardar la nota', '…xito');
      },
    });
  }

  cerrar() {
    this.ref.close();
  }
}
import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../../core/services/api';
import { Submission } from '../../../../core/models/task';
import { GradeBadge } from '../../../../shared/components/grade-badge/grade-badge';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { SlicePipe } from '@angular/common';

@Component({
  selector: 'app-task-grade',
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatIconModule, SlicePipe,
    GradeBadge, PageHeader, EmptyState,
  ],
  templateUrl: './task-grade.html',
  styleUrl: './task-grade.scss',
})
export class TaskGrade implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private toastr = inject(ToastService);

  taskId = this.route.snapshot.paramMap.get('id')!;
  submissions = signal<Submission[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.get<Submission[]>(`tasks/${this.taskId}/submissions`).subscribe({
      next: r => { this.submissions.set(r.data); this.loading.set(false); },
      error: () => { this.submissions.set([]); this.loading.set(false); },
    });
  }

  nombreAlumno(sub: Submission): string {
    const a = sub.alumno;
    if (!a) return 'Alumno';
    return `${a.apellido_paterno}${a.apellido_materno ? ' ' + a.apellido_materno : ''}, ${a.nombre}`;
  }

  saveGrade(sub: Submission) {
    this.api.patch(`submissions/${sub.id}/grade`, {
      calificacion_manual: sub.calificacion_manual,
      comentario_docente: sub.comentario_docente,
    }).subscribe({
      next: () => this.toastr.success('Nota guardada', 'Éxito'),
      error: () => this.toastr.success('Error al guardar', 'Éxito'),
    });
  }
}

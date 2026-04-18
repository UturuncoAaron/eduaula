import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
    MatInputModule, MatIconModule, MatSnackBarModule, SlicePipe,
    GradeBadge, PageHeader, EmptyState,
  ],
  templateUrl: './task-grade.html',
  styleUrl: './task-grade.scss',
})
export class TaskGrade implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  taskId = this.route.snapshot.paramMap.get('id')!;
  submissions = signal<Submission[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.get<Submission[]>(`tasks/${this.taskId}/submissions`).subscribe({
      next: r => { this.submissions.set(r.data); this.loading.set(false); },
      error: () => {
        this.submissions.set([
          { id: '1', tarea_id: this.taskId, alumno_id: 'a1', alumno: 'García, Carlos', respuesta_texto: 'Resolví los ejercicios aplicando la fórmula del área...', fecha_entrega: new Date().toISOString(), con_retraso: false },
          { id: '2', tarea_id: this.taskId, alumno_id: 'a2', alumno: 'López, María', respuesta_texto: 'Mi respuesta completa del ejercicio 3...', fecha_entrega: new Date().toISOString(), con_retraso: true },
        ]);
        this.loading.set(false);
      },
    });
  }

  saveGrade(sub: Submission) {
    this.api.patch(`tasks/${this.taskId}/submissions/${sub.id}/grade`, {
      calificacion: sub.calificacion,
      comentario: sub.comentario,
    }).subscribe({
      next: () => this.snack.open('Nota guardada', 'OK', { duration: 2000 }),
      error: () => this.snack.open('Error al guardar', 'OK', { duration: 2000 }),
    });
  }
}
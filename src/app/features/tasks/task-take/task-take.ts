import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../stores/task';
import { Pregunta, Task } from '../../../core/models/task';
import { PageHeader } from '../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-task-take',
  imports: [
    MatCardModule, MatButtonModule, MatRadioModule,
    MatProgressBarModule, MatIconModule, MatProgressSpinnerModule,
    MatSnackBarModule, FormsModule, PageHeader,
  ],
  templateUrl: './task-take.html',
  styleUrl: './task-take.scss',
})
export class TaskTake implements OnInit {
  objectKeys = Object.keys;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private taskSvc = inject(TaskService);
  private snack = inject(MatSnackBar);

  taskId = this.route.snapshot.paramMap.get('id')!;

  task = signal<Task | null>(null);
  questions = signal<Pregunta[]>([]);
  answers = signal<Record<string, string>>({});
  loading = signal(true);
  submitting = signal(false);

  progress = computed(() => {
    const q = this.questions().length;
    const a = Object.keys(this.answers()).length;
    return q ? Math.round((a / q) * 100) : 0;
  });

  ngOnInit() {
    this.taskSvc.getTask(this.taskId).subscribe({
      next: r => {
        this.task.set(r.data);
        this.questions.set(r.data.preguntas ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.snack.open('No se pudo cargar la tarea', 'OK', { duration: 3000 });
        this.loading.set(false);
        this.router.navigate(['/tareas']);
      },
    });
  }

  selectAnswer(preguntaId: string, opcionId: string) {
    this.answers.update(a => ({ ...a, [preguntaId]: opcionId }));
  }

  submit() {
    const q = this.questions().length;
    const a = Object.keys(this.answers()).length;
    if (a < q) {
      this.snack.open(`Faltan ${q - a} preguntas por responder`, 'OK', { duration: 3000 });
      return;
    }
    this.submitting.set(true);
    const respuestas = Object.entries(this.answers())
      .map(([pregunta_id, opcion_id]) => ({ pregunta_id, opcion_id }));

    this.taskSvc.submitAlternativas(this.taskId, respuestas).subscribe({
      next: r => {
        const data: any = r.data;
        const score = data?.calificacion_auto ?? data?.submission?.calificacion_auto ?? '—';
        this.snack.open(`Tarea enviada. Puntaje: ${score}`, 'OK', { duration: 4000 });
        this.router.navigate(['/tareas']);
      },
      error: () => {
        this.snack.open('Error al enviar la tarea', 'OK', { duration: 3000 });
        this.submitting.set(false);
      },
    });
  }
}
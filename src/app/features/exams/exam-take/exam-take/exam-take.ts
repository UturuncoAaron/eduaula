import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { ExamService } from '../../stores/exam';
import { Question, Answer } from '../../../../core/models/exam';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-exam-take',
  standalone: true,
  imports: [
    MatCardModule, MatButtonModule, MatRadioModule,
    MatProgressBarModule, MatIconModule, MatSnackBarModule,
    FormsModule, PageHeader,
  ],
  templateUrl: './exam-take.html',
  styleUrl: './exam-take.scss',
})
export class ExamTake implements OnInit {
objectKeys = Object.keys;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private examSvc = inject(ExamService);
  private snack = inject(MatSnackBar);

  examId = this.route.snapshot.paramMap.get('id')!;
  questions = signal<Question[]>([]);
  answers = signal<Record<string, string>>({});
  loading = signal(true);
  submitting = signal(false);

  get progress() {
    const q = this.questions().length;
    const a = Object.keys(this.answers()).length;
    return q ? Math.round((a / q) * 100) : 0;
  }

  ngOnInit() {
    this.examSvc.getExamWithQuestions(this.examId).subscribe({
      next: r => { this.questions.set(r.data); this.loading.set(false); },
      error: () => {
        this.questions.set([
          {
            id: 'q1', examen_id: this.examId, enunciado: '¿Cuánto es 2 + 2?',
            tipo: 'multiple', puntos: 2, orden: 1,
            opciones: [
              { id: 'o1', pregunta_id: 'q1', texto: '3', es_correcta: false, orden: 1 },
              { id: 'o2', pregunta_id: 'q1', texto: '4', es_correcta: true, orden: 2 },
              { id: 'o3', pregunta_id: 'q1', texto: '5', es_correcta: false, orden: 3 },
            ],
          },
          {
            id: 'q2', examen_id: this.examId, enunciado: 'El sol es una estrella',
            tipo: 'verdadero_falso', puntos: 2, orden: 2,
            opciones: [
              { id: 'o4', pregunta_id: 'q2', texto: 'Verdadero', es_correcta: true, orden: 1 },
              { id: 'o5', pregunta_id: 'q2', texto: 'Falso', es_correcta: false, orden: 2 },
            ],
          },
        ]);
        this.loading.set(false);
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
    const payload: Answer[] = Object.entries(this.answers())
      .map(([pregunta_id, opcion_id]) => ({ pregunta_id, opcion_id }));

    this.examSvc.submitAttempt(this.examId, payload).subscribe({
      next: r => {
        this.snack.open(
          `Examen enviado. Puntaje: ${r.data.puntaje ?? '—'}`,
          'OK', { duration: 4000 }
        );
        this.router.navigate(['/examenes']);
      },
      error: () => {
        this.snack.open('Error al enviar el examen', 'OK', { duration: 3000 });
        this.submitting.set(false);
      },
    });
  }
}
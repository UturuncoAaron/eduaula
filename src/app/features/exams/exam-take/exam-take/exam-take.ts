import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';
import { FormsModule } from '@angular/forms';
import { ExamService } from '../../stores/exam';
import { Question, Answer } from '../../../../core/models/exam';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-exam-take',
  imports: [
    MatCardModule, MatButtonModule, MatRadioModule,
    MatProgressBarModule, MatIconModule, MatProgressSpinnerModule,
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
  private toastr = inject(ToastService);

  examId = this.route.snapshot.paramMap.get('id')!;
  courseId = this.route.snapshot.queryParamMap.get('courseId')!;

  questions = signal<Question[]>([]);
  answers = signal<Record<string, string>>({});
  attemptId = signal<string | null>(null);
  loading = signal(true);
  submitting = signal(false);

  get progress(): number {
    const q = this.questions().length;
    const a = Object.keys(this.answers()).length;
    return q ? Math.round((a / q) * 100) : 0;
  }

  ngOnInit() {
    this.examSvc.getExamWithQuestions(this.courseId, this.examId).subscribe({
      next: r => {
        this.questions.set((r.data as any).preguntas ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.toastr.success('No se pudo cargar el examen', 'Éxito');
        this.loading.set(false);
        this.router.navigate(['/examenes']);
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
      this.toastr.success(`Faltan ${q - a} preguntas por responder`, 'Éxito');
      return;
    }
    this.submitting.set(true);
    const respuestas: Answer[] = Object.entries(this.answers())
      .map(([pregunta_id, opcion_id]) => ({ pregunta_id, opcion_id }));

    this.examSvc.submitAttempt(this.courseId, this.examId, '', respuestas).subscribe({
      next: r => {
        this.toastr.success(`Examen enviado. Puntaje: ${(r.data as any).calificacion_auto ?? r.data.puntaje ?? 'â€”'}`, 'Éxito');
        this.router.navigate(['/examenes']);
      },
      error: () => {
        this.toastr.success('Error al enviar el examen', 'Éxito');
        this.submitting.set(false);
      },
    });
  }
}
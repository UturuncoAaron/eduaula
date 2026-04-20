import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/services/api';
import { Exam, Attempt, Answer } from '../../../core/models/exam';

@Injectable({ providedIn: 'root' })
export class ExamService {
  private api = inject(ApiService);

  getExams(courseId: string) {
    return this.api.get<Exam[]>(`courses/${courseId}/exams`);
  }

  getExamWithQuestions(courseId: string, examId: string) {
    return this.api.get<Exam>(`courses/${courseId}/exams/${examId}`);
  }

  createExam(courseId: string, d: any) {
    return this.api.post<Exam>(`courses/${courseId}/exams`, d);
  }

  toggleExam(courseId: string, examId: string) {
    return this.api.patch<Exam>(`courses/${courseId}/exams/${examId}/toggle`, {});
  }

  startAttempt(courseId: string, examId: string) {
    return this.api.post<Attempt>(`courses/${courseId}/exams/${examId}/start`, {});
  }

  submitAttempt(courseId: string, examId: string, attemptId: string, respuestas: Answer[]) {
    return this.api.post<Attempt>(`courses/${courseId}/exams/${examId}/submit`, {
      attempt_id: attemptId,
      respuestas,
    });
  }

  getResults(courseId: string, examId: string) {
    return this.api.get<Attempt[]>(`courses/${courseId}/exams/${examId}/results`);
  }
}
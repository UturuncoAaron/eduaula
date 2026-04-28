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

  toggleExam(courseId: string, examId: string, activo: boolean) {
    return this.api.patch<Exam>(`courses/${courseId}/exams/${examId}/toggle`, { activo });
  }

  submitAttempt(courseId: string, examId: string, _attemptId: string, respuestas: Answer[]) {
    return this.api.post<Attempt>(`courses/${courseId}/exams/${examId}/submit`, { respuestas });
  }

  getResults(courseId: string, examId: string) {
    return this.api.get<Attempt[]>(`courses/${courseId}/exams/${examId}/results`);
  }
}
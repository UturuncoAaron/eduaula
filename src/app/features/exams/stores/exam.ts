import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/services/api';
import { Exam, Question, Attempt, Answer } from '../../../core/models/exam';

@Injectable({ providedIn: 'root' })
export class ExamService {
  private api = inject(ApiService);

  getExams(courseId?: string) {
    return courseId
      ? this.api.get<Exam[]>(`courses/${courseId}/exams`)
      : this.api.get<Exam[]>('exams');
  }
  createExam(courseId: string, d: Partial<Exam>) {
    return this.api.post<Exam>(`courses/${courseId}/exams`, d);
  }
  getExamWithQuestions(id: string) {
    return this.api.get<Question[]>(`exams/${id}/questions`);
  }
  startAttempt(id: string) {
    return this.api.post<Attempt>(`exams/${id}/start`, {});
  }
  submitAttempt(id: string, answers: Answer[]) {
    return this.api.post<Attempt>(`exams/${id}/submit`, { answers });
  }
  getResults(id: string) {
    return this.api.get<Attempt[]>(`exams/${id}/results`);
  }
}
import { Component, inject, input, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../../../../core/services/api';
import { AuthService } from '../../../../../core/auth/auth';
import { Exam } from '../../../../../core/models/exam';

@Component({
  selector: 'app-tab-examenes',
  standalone: true,
  imports: [ MatIconModule, MatButtonModule,RouterLink,DatePipe],
  templateUrl: './tab-examenes.html',
  styleUrl:    './tab-examenes.scss',
})
export class TabExamenes implements OnInit {
  readonly auth  = inject(AuthService);
  private api    = inject(ApiService);
  private dialog = inject(MatDialog);

  courseId = input.required<string>();

  exams   = signal<Exam[]>([]);
  loading = signal(true);

  ngOnInit() { this.loadExams(); }

  loadExams() {
    this.loading.set(true);
    this.api.get<Exam[]>(`courses/${this.courseId()}/exams`).subscribe({
      next: res => { this.exams.set(res.data ?? []); this.loading.set(false); },
      error: () => { this.exams.set([]); this.loading.set(false); },
    });
  }

  async openCreateExam() {
    const { ExamCreate } = await import(
      '../../../../exams/exam-create/exam-create/exam-create'
    );
    const ref = this.dialog.open(ExamCreate, {
      data: this.courseId(), width: '620px', maxHeight: '90vh',
    });
    ref.afterClosed().subscribe(r => { if (r) this.loadExams(); });
  }
}
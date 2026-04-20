import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ExamService } from '../../stores/exam';
import { Attempt } from '../../../../core/models/exam';
import { GradeBadge } from '../../../../shared/components/grade-badge/grade-badge';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { SlicePipe } from '@angular/common';

@Component({
  selector: 'app-exam-results',
  imports: [MatTableModule, MatCardModule, MatIconModule, GradeBadge, PageHeader, SlicePipe],
  templateUrl: './exam-results.html',
  styleUrl: './exam-results.scss',
})
export class ExamResults implements OnInit {
  private route = inject(ActivatedRoute);
  private examSvc = inject(ExamService);

  examId = this.route.snapshot.paramMap.get('id')!;
  courseId = this.route.snapshot.queryParamMap.get('courseId')!;

  attempts = signal<Attempt[]>([]);
  loading = signal(true);
  cols = ['alumno', 'puntaje', 'escala', 'fecha'];

  ngOnInit() {
    this.examSvc.getResults(this.courseId, this.examId).subscribe({
      next: r => { this.attempts.set(r.data); this.loading.set(false); },
      error: () => { this.attempts.set([]); this.loading.set(false); },
    });
  }
}
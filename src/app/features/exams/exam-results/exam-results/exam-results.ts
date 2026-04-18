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
  standalone: true,
  imports: [MatTableModule, MatCardModule, MatIconModule, GradeBadge, PageHeader, SlicePipe],
  templateUrl: './exam-results.html',
  styleUrl: './exam-results.scss',
})
export class ExamResults implements OnInit {
  private route = inject(ActivatedRoute);
  private examSvc = inject(ExamService);

  examId = this.route.snapshot.paramMap.get('id')!;
  attempts = signal<Attempt[]>([]);
  loading = signal(true);
  cols = ['alumno', 'puntaje', 'escala', 'fecha'];

  ngOnInit() {
    this.examSvc.getResults(this.examId).subscribe({
      next: r => { this.attempts.set(r.data); this.loading.set(false); },
      error: () => {
        this.attempts.set([
          { id: '1', examen_id: this.examId, alumno_id: 'a1', alumno: 'García, Carlos', fecha_inicio: new Date().toISOString(), puntaje: 18, completado: true },
          { id: '2', examen_id: this.examId, alumno_id: 'a2', alumno: 'López, María', fecha_inicio: new Date().toISOString(), puntaje: 14, completado: true },
          { id: '3', examen_id: this.examId, alumno_id: 'a3', alumno: 'Torres, Pedro', fecha_inicio: new Date().toISOString(), puntaje: 11, completado: true },
          { id: '4', examen_id: this.examId, alumno_id: 'a4', alumno: 'Quispe, Ana', fecha_inicio: new Date().toISOString(), puntaje: 8, completado: true },
        ]);
        this.loading.set(false);
      },
    });
  }
}

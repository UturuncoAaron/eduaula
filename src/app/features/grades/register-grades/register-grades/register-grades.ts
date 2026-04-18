import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../core/services/api';
import { Grade } from '../../../../core/models/grade';
import { GradeBadge } from '../../../../shared/components/grade-badge/grade-badge';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-register-grades',
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatTableModule, MatFormFieldModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatSnackBarModule,
    GradeBadge, PageHeader,
  ],
  templateUrl: './register-grades.html',
  styleUrl: './register-grades.scss',
})
export class RegisterGrades implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  grades = signal<Grade[]>([]);
  loading = signal(true);
  bimestre = 1;
  cols = ['alumno', 'examenes', 'tareas', 'participacion', 'final', 'escala', 'guardar'];

  calcFinal(g: Grade): number {
    const e = g.nota_examenes ?? 0;
    const t = g.nota_tareas ?? 0;
    const p = g.nota_participacion ?? 0;
    return Math.round(((e + t + p) / 3) * 10) / 10;
  }

  ngOnInit() {
    this.api.get<Grade[]>('grades/course/current').subscribe({
      next: r => { this.grades.set(r.data); this.loading.set(false); },
      error: () => {
        this.grades.set([
          { id: '1', alumno_id: 'a1', alumno: 'García, Carlos', curso_id: '', periodo_id: 1, bimestre: 1 },
          { id: '2', alumno_id: 'a2', alumno: 'López, María', curso_id: '', periodo_id: 1, bimestre: 1 },
          { id: '3', alumno_id: 'a3', alumno: 'Torres, Pedro', curso_id: '', periodo_id: 1, bimestre: 1 },
          { id: '4', alumno_id: 'a4', alumno: 'Quispe, Ana', curso_id: '', periodo_id: 1, bimestre: 1 },
        ]);
        this.loading.set(false);
      },
    });
  }

  saveGrade(g: Grade) {
    g.nota_final = this.calcFinal(g);
    this.api.post('grades', g).subscribe({
      next: () => this.snack.open('Nota guardada', 'OK', { duration: 2000 }),
      error: () => this.snack.open('Error al guardar', 'OK', { duration: 2000 }),
    });
  }
}
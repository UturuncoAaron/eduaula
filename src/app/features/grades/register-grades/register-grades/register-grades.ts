import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../core/services/api';
import { Grade } from '../../../../core/models/grade';
import { GradeBadge } from '../../../../shared/components/grade-badge/grade-badge';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-register-grades',
  imports: [
    FormsModule, MatCardModule, MatTableModule, MatFormFieldModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule,
    GradeBadge, PageHeader, EmptyState,
  ],
  templateUrl: './register-grades.html',
  styleUrl: './register-grades.scss',
})
export class RegisterGrades implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private route = inject(ActivatedRoute);

  grades = signal<Grade[]>([]);
  loading = signal(true);
  saving = signal(false);
  cursoNombre = signal('');

  cursoId = '';
  periodoId = 1;
  bimestre = 1;

  cols = ['alumno', 'examenes', 'tareas', 'participacion', 'final', 'escala', 'guardar'];

  ngOnInit() {
    this.cursoId = this.route.snapshot.queryParamMap.get('cursoId') ?? '';
    this.bimestre = parseInt(this.route.snapshot.queryParamMap.get('bimestre') ?? '1');
    this.periodoId = parseInt(this.route.snapshot.queryParamMap.get('periodoId') ?? '1');
    this.cursoNombre.set(this.route.snapshot.queryParamMap.get('cursoNombre') ?? 'Curso');
    this.loadGrades();
  }

  loadGrades() {
    this.loading.set(true);
    this.api.get<Grade[]>(`grades/course/${this.cursoId}?bimestre=${this.bimestre}`).subscribe({
      next: r => { this.grades.set(r.data); this.loading.set(false); },
      error: () => { this.grades.set([]); this.loading.set(false); },
    });
  }

  onBimestreChange() {
    this.loadGrades();
  }

  calcFinal(g: Grade) {
    const vals = [g.nota_examenes, g.nota_tareas, g.nota_participacion]
      .filter(n => n != null) as number[];
    g.nota_final = vals.length > 0
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
      : null;
  }

  saveGrade(g: Grade) {
    this.calcFinal(g);
    this.api.post('grades', {
      alumno_id: g.alumno_id,
      curso_id: this.cursoId,
      periodo_id: this.periodoId,
      bimestre: this.bimestre,
      nota_examenes: g.nota_examenes,
      nota_tareas: g.nota_tareas,
      nota_participacion: g.nota_participacion,
      nota_final: g.nota_final,
    }).subscribe({
      next: () => this.snack.open('Nota guardada', 'OK', { duration: 2000 }),
      error: () => this.snack.open('Error al guardar', 'OK', { duration: 2000 }),
    });
  }

  saveAll() {
    this.saving.set(true);
    const requests = this.grades().map(g => {
      this.calcFinal(g);
      return this.api.post('grades', {
        alumno_id: g.alumno_id,
        curso_id: this.cursoId,
        periodo_id: this.periodoId,
        bimestre: this.bimestre,
        nota_examenes: g.nota_examenes,
        nota_tareas: g.nota_tareas,
        nota_participacion: g.nota_participacion,
        nota_final: g.nota_final,
      }).toPromise().catch(() => null);
    });

    Promise.all(requests).then(() => {
      this.snack.open('Todas las notas guardadas', 'OK', { duration: 3000 });
      this.saving.set(false);
    });
  }
}
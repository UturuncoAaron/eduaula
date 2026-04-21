import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { ApiService } from '../../../../core/services/api';
import { AuthService } from '../../../../core/auth/auth';

interface Grade {
  bimestre: number;
  curso: string;
  nota_examenes: number | null;
  nota_tareas: number | null;
  nota_participacion: number | null;
  nota_final: number | null;
  escala: string | null;
  observaciones: string | null;
  periodo: string;
  anio: number;
}

@Component({
  selector: 'app-child-grades',
  imports: [RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTableModule],
  templateUrl: './child-grades.html',
  styleUrl: './child-grades.scss',
})
export class ChildGrades implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  readonly auth = inject(AuthService);

  grades = signal<Grade[]>([]);
  loading = signal(true);
  alumnoId = '';
  cols = ['curso', 'bimestre', 'nota_examenes', 'nota_tareas', 'nota_participacion', 'nota_final', 'escala'];

  ngOnInit() {
    this.alumnoId = this.route.snapshot.params['id'];
    const padreId = this.auth.currentUser()?.id;
    if (!padreId) { this.loading.set(false); return; }

    // TODO: quitar ?padreId= cuando JWT esté activo
    this.api.get<Grade[]>(`parent/children/${this.alumnoId}/grades`, { padreId }).subscribe({
      next: r => { this.grades.set(r.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  getEscalaColor(escala: string | null): string {
    switch (escala) {
      case 'AD': return '#166534';
      case 'A': return '#1d4ed8';
      case 'B': return '#92400e';
      case 'C': return '#991b1b';
      default: return '#6b7280';
    }
  }

  getEscalaBg(escala: string | null): string {
    switch (escala) {
      case 'AD': return '#dcfce7';
      case 'A': return '#dbeafe';
      case 'B': return '#fef3c7';
      case 'C': return '#fee2e2';
      default: return '#f1f5f9';
    }
  }
}
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';
import { PeriodoService } from '../../../core/services/periodo';
import { GradeBadge } from '../../../shared/components/grade-badge/grade-badge';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

interface Course {
  id: string;
  nombre: string;
  descripcion?: string | null;
  color?: string | null;
  periodo_id: number;
  seccion?: { nombre: string; grado?: { nombre: string } | null } | null;
}

type TipoNota =
  | 'tarea' | 'practica'
  | 'participacion' | 'proyecto' | 'otro';

interface MyGrade {
  id: string;
  titulo: string;
  tipo: TipoNota;
  nota: number | null;
  observaciones: string | null;
  fecha: string | null;
  curso_id: string;
  periodo_id: number;
  curso_nombre: string;
  curso_color: string | null;
  bimestre: number;
  anio: number;
  periodo_nombre: string;
}

interface CursoAgrupado {
  cursoId: string;
  cursoNombre: string;
  cursoColor: string | null;
  notas: MyGrade[];
  promedio: number | null;
}

const TIPO_LABEL: Record<TipoNota, string> = {
  tarea: 'Tarea', practica: 'Práctica',
  participacion: 'Participación', proyecto: 'Proyecto', otro: 'Otro',
};
const TIPO_ICON: Record<TipoNota, string> = {
  tarea: 'assignment', practica: 'edit_note',
  participacion: 'forum', proyecto: 'rocket_launch', otro: 'star',
};

@Component({
  selector: 'app-my-grades',
  imports: [
    FormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatTooltipModule, MatExpansionModule,
    GradeBadge, PageHeader, EmptyState,
  ],
  templateUrl: './my-grades.html',
  styleUrl: './my-grades.scss',
})
export class MyGrades implements OnInit {
  readonly auth = inject(AuthService);
  readonly periodoService = inject(PeriodoService);
  private api = inject(ApiService);

  readonly TIPO_LABEL = TIPO_LABEL;
  readonly TIPO_ICON = TIPO_ICON;

  grades = signal<MyGrade[]>([]);
  courses = signal<Course[]>([]);
  loading = signal(true);
  bimestre = 1;

  /** Bimestres que el alumno tiene en su historial (derivado de notas). */
  bimestresConData = computed(() =>
    [...new Set(this.grades().map(g => g.bimestre))]
      .sort((a, b) => a - b),
  );

  cursosAgrupados = computed<CursoAgrupado[]>(() => {
    const filtered = this.grades().filter(g => g.bimestre === this.bimestre);
    const grupos = new Map<string, CursoAgrupado>();
    for (const g of filtered) {
      let grupo = grupos.get(g.curso_id);
      if (!grupo) {
        grupo = {
          cursoId: g.curso_id,
          cursoNombre: g.curso_nombre,
          cursoColor: g.curso_color,
          notas: [],
          promedio: null,
        };
        grupos.set(g.curso_id, grupo);
      }
      grupo.notas.push(g);
    }
    for (const grupo of grupos.values()) {
      const valores = grupo.notas
        .map(n => n.nota)
        .filter((v): v is number => v != null);
      grupo.promedio = valores.length === 0
        ? null
        : Math.round(
          (valores.reduce((a, b) => a + b, 0) / valores.length) * 100,
        ) / 100;
    }
    return [...grupos.values()].sort((a, b) =>
      a.cursoNombre.localeCompare(b.cursoNombre),
    );
  });

  hasGroupedGrades = computed(() => this.cursosAgrupados().length > 0);

  ngOnInit() {
    this.periodoService.loadAll();

    if (this.auth.isDocente() || this.auth.isAdmin?.()) {
      this.loadCourses();
    } else {
      this.loadMyGrades();
    }
  }

  loadCourses() {
    this.loading.set(true);
    this.api.get<Course[]>('courses').subscribe({
      next: r => {
        this.courses.set((r as any).data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.courses.set([]);
        this.loading.set(false);
      },
    });
  }

  loadMyGrades() {
    this.loading.set(true);
    this.api.get<any>('grades/my').subscribe({
      next: r => {
        // Soporta tanto array directo como { data: [...] }
        const data: MyGrade[] = Array.isArray(r)
          ? r
          : Array.isArray((r as any)?.data)
            ? (r as any).data
            : [];

        this.grades.set(data);

        // Default al bimestre activo si está en la data, sino al primero con datos
        const activo = this.periodoService.activo();
        const bims = [...new Set(data.map((g: MyGrade) => g.bimestre))].sort();
        if (activo && bims.includes(activo.bimestre)) {
          this.bimestre = activo.bimestre;
        } else if (bims.length > 0) {
          this.bimestre = bims[0] as number;
        }
        this.loading.set(false);
      },
      error: () => {
        this.grades.set([]);
        this.loading.set(false);
      },
    });
  }
}
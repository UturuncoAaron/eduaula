import {
  Component, inject, input, signal,
  computed, effect, OnInit,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../../core/services/api';
import { EnrollAlumnoDialog } from '../../../../shared/components/enroll-alumno-dialog/enroll-alumno-dialog';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import type { Section, GradeLevel } from '../../../../core/models/academic';

export interface AlumnoMatriculado {
  id:                string;
  alumno_id:         string;
  nombre:            string;
  apellido_paterno:  string;
  apellido_materno?: string;
  codigo_estudiante: string;
  activo:            boolean;
}

@Component({
  selector: 'app-seccion-alumnos',
  standalone: true,
  imports: [
    MatIconModule, MatButtonModule, MatTooltipModule,
    MatDialogModule, MatProgressSpinnerModule,
  ],
  templateUrl: './seccion-alumnos.html',
  styleUrl:    './seccion-alumnos.scss',
})
export class SeccionAlumnos implements OnInit {
  private api    = inject(ApiService);
  private toastr = inject(ToastService);
  private dialog = inject(MatDialog);

  seccion = input.required<Section>();
  grado   = input.required<GradeLevel>();
  periodoId = input<number | null>(null);

  alumnos  = signal<AlumnoMatriculado[]>([]);
  loading  = signal(true);

  matriculadosCount = computed(() => this.alumnos().length);
  capacidad         = computed(() => this.seccion().capacidad ?? 35);
  porcentaje        = computed(() =>
    Math.round((this.matriculadosCount() / this.capacidad()) * 100)
  );
  alumnosIds = computed(() => this.alumnos().map(a => a.alumno_id ?? a.id));

  constructor() {
    effect(() => {
      const s = this.seccion();
      if (s?.id) this.loadAlumnos();
    });
  }

  ngOnInit() { this.loadAlumnos(); }

  loadAlumnos() {
    this.loading.set(true);
    this.api.get<any[]>(`courses/seccion/${this.seccion().id}/students`).subscribe({
      next: (res) => {
        const raw = (res as any).data ?? [];
        this.alumnos.set(raw.map((e: any) => ({
          id:               e.id,
          alumno_id:        e.alumno_id ?? e.alumno?.id ?? e.id,
          nombre:           e.alumno?.nombre ?? e.nombre ?? '',
          apellido_paterno: e.alumno?.apellido_paterno ?? e.apellido_paterno ?? '',
          apellido_materno: e.alumno?.apellido_materno ?? e.apellido_materno,
          codigo_estudiante: e.alumno?.codigo_estudiante ?? e.codigo_estudiante ?? '',
          activo:           e.activo ?? true,
        })));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openMatricular() {
    const pid = this.periodoId();
    if (!pid) {
      this.toastr.error('No hay un periodo activo. Activa uno primero.', 'Error');
      return;
    }

    const ref = this.dialog.open(EnrollAlumnoDialog, {
      width: '500px',
      data: {
        seccionId:              this.seccion().id,
        periodoId:              pid,
        seccionNombre:          this.seccion().nombre,
        gradoNombre:            this.grado().nombre,
        alumnosMatriculadosIds: this.alumnosIds(),
      },
    });

    ref.afterClosed().subscribe((enrolled: any) => {
      if (enrolled) this.loadAlumnos();
    });
  }

  retirarAlumno(alumno: AlumnoMatriculado) {
    const ref = this.dialog.open(ConfirmDialog, {
      width: '380px',
      data: {
        title:   '¿Retirar alumno?',
        message: `Se retirará a ${alumno.nombre} ${alumno.apellido_paterno} de la sección "${this.seccion().nombre}". Perderá acceso a los cursos.`,
        confirm: 'Retirar',
        cancel:  'Cancelar',
        danger:  true,
      },
    });

    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      // Desactivar matrícula
      this.api.delete(`courses/enroll/${alumno.id}`).subscribe({
        next: () => {
          this.alumnos.update(list => list.filter(a => a.id !== alumno.id));
          this.toastr.success(`${alumno.nombre} ${alumno.apellido_paterno} retirado`, 'Éxito');
        },
        error: () => this.toastr.error('Error al retirar alumno', 'Error'),
      });
    });
  }

  getInitials(nombre: string, apellido: string): string {
    return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
  }
}
import { Component, inject, signal, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api';

export interface AlumnoNotasDialogData {
  alumnoId: string;
  nombre: string;
  seccionNombre?: string;
  gradoNombre?: string;
}

interface NotaCurso {
  curso_id: string;
  curso_nombre: string;
  color: string;
  docente?: string;
  promedio?: number;
  notas: { periodo: string; valor: number | null }[];
}

@Component({
  selector: 'app-alumno-notas-dialog',
  standalone: true,
  imports: [
    MatDialogModule, MatIconModule,
    MatButtonModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  templateUrl: './alumno-notas-dialog.html',
  styleUrl: './alumno-notas-dialog.scss',
})
export class AlumnoNotasDialog implements OnInit {
  readonly data: AlumnoNotasDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<AlumnoNotasDialog>);
  private api = inject(ApiService);

  notas = signal<NotaCurso[]>([]);
  loading = signal(true);
  error = signal(false);
  promediogeneral = signal<number | null>(null);

  ngOnInit(): void { this.loadNotas(); }

  loadNotas(): void {
    this.loading.set(true);
    this.error.set(false);

    this.api.get<any>(`grades/alumno/${this.data.alumnoId}`).subscribe({
      next: (res) => {
        // Soporta tanto array directo como { data: [...] }
        const raw: any[] = Array.isArray(res)
          ? res
          : Array.isArray((res as any)?.data)
            ? (res as any).data
            : [];

        const map = new Map<string, NotaCurso>();

        for (const n of raw) {
          const key = n.curso_id ?? n.curso?.id ?? n.id;
          if (!map.has(key)) {
            map.set(key, {
              curso_id: key,
              curso_nombre: n.curso?.nombre ?? n.nombre_curso ?? '—',
              color: n.curso?.color ?? '#6B7280',
              docente: n.curso?.docente
                ? `${n.curso.docente.nombre} ${n.curso.docente.apellido_paterno}`
                : undefined,
              promedio: undefined,
              notas: [],
            });
          }
          map.get(key)!.notas.push({
            periodo: n.titulo ?? n.periodo?.nombre ?? n.periodo_nombre ?? `Bim. ${n.bimestre ?? '?'}`,
            valor: n.valor ?? n.nota ?? null,
          });
        }

        const cursos = Array.from(map.values()).map(c => {
          const vals = c.notas.filter(n => n.valor !== null).map(n => n.valor as number);
          c.promedio = vals.length
            ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
            : undefined;
          return c;
        });

        this.notas.set(cursos);

        const promedios = cursos
          .filter(c => c.promedio !== undefined)
          .map(c => c.promedio as number);
        if (promedios.length) {
          this.promediogeneral.set(
            Math.round((promedios.reduce((a, b) => a + b, 0) / promedios.length) * 10) / 10,
          );
        }
        this.loading.set(false);
      },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  /** Escala vigesimal peruana: AD 18-20 · A 14-17 · B 11-13 · C 0-10 */
  getNotaClass(valor: number | null): string {
    if (valor === null) return 'nota-empty';
    if (valor >= 18) return 'nota-ad';
    if (valor >= 14) return 'nota-a';
    if (valor >= 11) return 'nota-b';
    return 'nota-c';
  }

  getPromedioClass(valor: number | undefined): string {
    if (valor === undefined) return 'nota-empty';
    if (valor >= 18) return 'nota-ad';
    if (valor >= 14) return 'nota-a';
    if (valor >= 11) return 'nota-b';
    return 'nota-c';
  }

  /** Genera iniciales desde "Apellido, Nombre" o "Nombre Apellido" */
  getInitials(nombreCompleto: string): string {
    const clean = nombreCompleto.replace(',', '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].substring(0, 2).toUpperCase();
    return '?';
  }

  close(): void { this.ref.close(); }
}
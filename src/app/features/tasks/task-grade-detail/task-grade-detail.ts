import {
  Component, inject, signal, computed,
  OnInit, OnDestroy, ChangeDetectionStrategy,
} from '@angular/core';
import { Location, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { ToastService } from 'ngx-toastr-notifier';

import { TaskService } from '../data-access/task.store';
import { GradeBadge } from '../../../shared/components/grade-badge/grade-badge';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Submission, Task, Pregunta } from '../../../core/models/task';

interface VistaPdf { tipo: 'pdf'; url: SafeResourceUrl }
interface VistaImagen { tipo: 'imagen'; url: string }
interface VistaOtro { tipo: 'otro'; nombre: string; extension: string; icono: string }
type VistaArchivo = VistaPdf | VistaImagen | VistaOtro;

function extensionDe(nombre: string): string {
  return (nombre.split('.').pop() ?? '').toLowerCase();
}

function iconoPorExtension(ext: string): string {
  if (['doc', 'docx'].includes(ext)) return 'description';
  if (['xls', 'xlsx'].includes(ext)) return 'table_chart';
  if (['ppt', 'pptx'].includes(ext)) return 'slideshow';
  if (ext === 'txt') return 'text_snippet';
  return 'insert_drive_file';
}

function resolverVista(nombre: string, url: string, sanitizer: DomSanitizer): VistaArchivo {
  const ext = extensionDe(nombre);
  if (ext === 'pdf') return { tipo: 'pdf', url: sanitizer.bypassSecurityTrustResourceUrl(url) };
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return { tipo: 'imagen', url };
  return { tipo: 'otro', nombre, extension: ext.toUpperCase(), icono: iconoPorExtension(ext) };
}

@Component({
  selector: 'app-task-grade-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule,
    MatRadioModule,
    GradeBadge, PageHeader, EmptyState,
  ],
  templateUrl: './task-grade-detail.html',
  styleUrl: './task-grade-detail.scss',
})
export class TaskGradeDetail implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private taskSvc = inject(TaskService);
  private toastr = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private fb = inject(FormBuilder);

  taskId = this.route.snapshot.paramMap.get('id')!;
  alumnoId = this.route.snapshot.paramMap.get('alumnoId')!;

  loading = signal(true);
  saving = signal(false);
  task = signal<Task | null>(null);
  submission = signal<Submission | null>(null);
  nombreAlumno = signal('');

  vistaArchivo = signal<VistaArchivo | null>(null);
  archivoExpand = signal(true);
  cargandoVista = signal(false);
  private objectUrl: string | null = null;

  form = this.fb.group({
    calificacion_manual: [null as number | null, [Validators.required, Validators.min(0), Validators.max(20)]],
    comentario_docente: [null as string | null],
  });

  esInteractiva = computed(() => !!this.task()?.permite_alternativas);

  preguntas = computed<Pregunta[]>(() => this.task()?.preguntas ?? []);

  // pregunta_id → opcion_id elegida por el alumno
  respuestasMap = computed<Record<string, string>>(() => {
    const sub = this.submission();
    if (!sub?.respuestas) return {};
    return Object.fromEntries(sub.respuestas.map(r => [r.pregunta_id, r.opcion_id]));
  });

  // puntos obtenidos por el alumno en interactiva
  puntosObtenidos = computed(() => {
    const sub = this.submission();
    return sub?.calificacion_auto ?? null;
  });

  notaActual = computed(() => {
    if (this.esInteractiva()) return this.puntosObtenidos();
    const v = this.form.get('calificacion_manual')?.value;
    return v != null && !isNaN(Number(v)) ? Number(v) : null;
  });

  yaCalificada = computed(() => this.submission()?.calificacion_final != null);

  get archivoPdf(): VistaPdf | null {
    const v = this.vistaArchivo();
    return v?.tipo === 'pdf' ? v : null;
  }
  get archivoImagen(): VistaImagen | null {
    const v = this.vistaArchivo();
    return v?.tipo === 'imagen' ? v : null;
  }
  get archivoOtro(): VistaOtro | null {
    const v = this.vistaArchivo();
    return v?.tipo === 'otro' ? v : null;
  }

  // helpers para el template — evitan lógica compleja en el html
  opcionSeleccionadaPorAlumno(preguntaId: string, opcionId: string): boolean {
    return this.respuestasMap()[preguntaId] === opcionId;
  }

  estadoOpcion(preguntaId: string, opcionId: string, esCorrecta: boolean): 'correcta' | 'incorrecta' | 'neutra' {
    const seleccionada = this.opcionSeleccionadaPorAlumno(preguntaId, opcionId);
    if (esCorrecta) return 'correcta';
    if (seleccionada && !esCorrecta) return 'incorrecta';
    return 'neutra';
  }

  ngOnInit() {
    forkJoin({
      task: this.taskSvc.getTask(this.taskId),
      subs: this.taskSvc.getSubmissions(this.taskId),
    }).subscribe({
      next: ({ task, subs }) => {
        this.task.set(task.data);

        const sub = (subs.data as Submission[]).find(s => s.alumno_id === this.alumnoId) ?? null;
        this.submission.set(sub);

        if (sub?.alumno) {
          const a = sub.alumno;
          this.nombreAlumno.set(
            `${a.apellido_paterno}${a.apellido_materno ? ' ' + a.apellido_materno : ''}, ${a.nombre}`,
          );
        }

        if (sub) {
          this.form.patchValue({
            calificacion_manual: sub.calificacion_manual ?? null,
            comentario_docente: sub.comentario_docente ?? null,
          });
        }

        if (sub?.storage_key && sub.nombre_archivo) {
          this.cargandoVista.set(true);
          this.taskSvc.getSubmissionFileUrl(sub.id).subscribe({
            next: urlRes => {
              this.vistaArchivo.set(
                resolverVista(sub.nombre_archivo ?? '', urlRes.data.url, this.sanitizer),
              );
              this.cargandoVista.set(false);
            },
            error: () => this.cargandoVista.set(false),
          });
        }

        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('No se pudo cargar la entrega', 'Error');
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  toggleArchivo() { this.archivoExpand.update(v => !v); }
  goBack() { this.location.back(); }

  saveGrade() {
    if (this.form.invalid || this.saving()) return;
    const sub = this.submission();
    if (!sub) return;

    const { calificacion_manual, comentario_docente } = this.form.value;
    this.saving.set(true);
    this.taskSvc.gradeSubmission(sub.id, {
      calificacion_manual: calificacion_manual!,
      comentario_docente: comentario_docente ?? null,
    }).subscribe({
      next: res => {
        this.submission.update(s => s ? { ...s, ...res.data } : s);
        this.toastr.success('Nota guardada correctamente', 'Éxito');
        this.saving.set(false);
      },
      error: () => {
        this.toastr.error('Error al guardar la nota', 'Error');
        this.saving.set(false);
      },
    });
  }
}
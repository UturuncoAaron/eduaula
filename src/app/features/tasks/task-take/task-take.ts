import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../data-access/task.store';
import { Pregunta, Task } from '../../../core/models/task';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import {
  ItemColapsable, VistaPdf, VistaImagen, VistaOtro,
  toItemColapsable,
} from '../task-submit/task-submit';

@Component({
  selector: 'app-task-take',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatProgressBarModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FormsModule,
    PageHeader,
  ],
  templateUrl: './task-take.html',
  styleUrl: './task-take.scss',
})
export class TaskTake implements OnInit {
  objectKeys = Object.keys;
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private taskSvc = inject(TaskService);
  private toastr = inject(ToastService);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  taskId = this.route.snapshot.paramMap.get('id')!;

  task = signal<Task | null>(null);
  questions = signal<Pregunta[]>([]);
  answers = signal<Record<string, string>>({});
  loading = signal(true);
  submitting = signal(false);

  enunciado = signal<ItemColapsable | null>(null);

  get enunciadoPdf(): VistaPdf | null {
    const v = this.enunciado()?.vista;
    return v?.tipo === 'pdf' ? v : null;
  }
  get enunciadoImagen(): VistaImagen | null {
    const v = this.enunciado()?.vista;
    return v?.tipo === 'imagen' ? v : null;
  }
  get enunciadoOtro(): VistaOtro | null {
    const v = this.enunciado()?.vista;
    return v?.tipo === 'otro' ? v : null;
  }

  progress = computed(() => {
    const q = this.questions().length;
    const a = Object.keys(this.answers()).length;
    return q ? Math.round((a / q) * 100) : 0;
  });

  ngOnInit() {
    this.taskSvc.getTask(this.taskId).subscribe({
      next: r => {
        this.task.set(r.data);
        this.questions.set(r.data.preguntas ?? []);
        this.loading.set(false);
        this.cargarEnunciado(r.data);
      },
      error: () => {
        this.toastr.error('No se pudo cargar la tarea', 'Error');
        this.loading.set(false);
        this.location.back();
      },
    });
  }

  private cargarEnunciado(t: Task) {
    if (!t.enunciado_storage_key && !t.enunciado_url) return;
    this.taskSvc.getEnunciadoUrl(t.id).subscribe({
      next: res => {
        const item = toItemColapsable(
          'enunciado',
          t.enunciado_url ?? 'Archivo de la tarea',
          'enunciado',
          res.data.url,
          t.enunciado_storage_key ?? null,
          res.data.nombre ?? null,
          null,
          null,
          null,
          this.sanitizer,
        );
        this.enunciado.set({ ...item, expandido: true });
      },
      error: () => { },
    });
  }

  toggleEnunciado() {
    this.enunciado.update(e => e ? { ...e, expandido: !e.expandido } : e);
  }

  formatBytes(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Nueva lógica que permite marcar y desmarcar
  toggleAnswer(preguntaId: string, opcionId: string) {
    this.answers.update(a => {
      const newAnswers = { ...a };
      if (newAnswers[preguntaId] === opcionId) {
        delete newAnswers[preguntaId];
      } else {
        newAnswers[preguntaId] = opcionId;
      }
      return newAnswers;
    });
  }

  submit() {
    const q = this.questions().length;
    const a = Object.keys(this.answers()).length;

    if (a < q) {
      this.toastr.warning(`Faltan ${q - a} preguntas por responder`, 'Aviso');
      return;
    }

    this.submitting.set(true);
    const respuestas = Object.entries(this.answers())
      .map(([pregunta_id, opcion_id]) => ({ pregunta_id, opcion_id }));

    this.taskSvc.submitAlternativas(this.taskId, respuestas).subscribe({
      next: () => {
        this.toastr.success('Tarea enviada correctamente', 'Éxito');
        this.location.back();
      },
      error: () => {
        this.toastr.error('Error al enviar la tarea', 'Error');
        this.submitting.set(false);
      },
    });
  }

  goBack() {
    const t = this.task();
    if (t?.curso_id) {
      this.router.navigate(['/cursos', t.curso_id, 'actividades']);
    } else {
      this.location.back();
    }
  }
}
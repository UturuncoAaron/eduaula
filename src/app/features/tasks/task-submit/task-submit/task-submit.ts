import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';
import { TaskService } from '../../stores/task';
import { Task, tipoEntregaTarea } from '../../../../core/models/task';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-task-submit',
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatCardModule,
    MatProgressSpinnerModule, RouterLink, PageHeader, DatePipe,
  ],
  templateUrl: './task-submit.html',
  styleUrl: './task-submit.scss',
})
export class TaskSubmit implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private taskSvc = inject(TaskService);
  private toastr = inject(ToastService);
  private sanitizer = inject(DomSanitizer);

  taskId = this.route.snapshot.paramMap.get('id')!;

  task = signal<Task | null>(null);
  loading = signal(true);
  sending = signal(false);
  selectedFile = signal<File | null>(null);
  materialUrl = signal<SafeResourceUrl | null>(null);
  materialNombre = signal<string | null>(null);

  puedeTexto = computed(() => !!this.task()?.permite_texto);
  puedeArchivo = computed(() => !!this.task()?.permite_archivo);

  form = this.fb.group({
    respuesta_texto: [''],
  });

  ngOnInit() {
    this.taskSvc.getTask(this.taskId).subscribe({
      next: r => {
        const t = r.data;
        this.task.set(t);
        this.loading.set(false);

        if (tipoEntregaTarea(t) === 'interactiva') {
          this.router.navigate(['/tareas', t.id, 'tomar']);
          return;
        }

        if (t.enunciado_storage_key || t.enunciado_url) {
          this.taskSvc.getEnunciadoUrl(t.id).subscribe({
            next: res => {
              this.materialUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(res.data.url));
              this.materialNombre.set(res.data.nombre ?? null);
            },
            error: () => this.materialUrl.set(null),
          });
        }
      },
      error: () => {
        this.toastr.success('No se pudo cargar la tarea', 'Éxito');
        this.loading.set(false);
        this.router.navigate(['/tareas']);
      },
    });
  }

  onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  clearFile() { this.selectedFile.set(null); }

  submit() {
    if (this.sending()) return;
    const t = this.task();
    if (!t) return;

    const texto = (this.form.value.respuesta_texto ?? '').trim();
    const file = this.selectedFile();

    if (!texto && !file) {
      this.toastr.success('Debes escribir una respuesta o adjuntar un archivo', 'Éxito');
      return;
    }

    this.sending.set(true);

    if (file) {
      this.taskSvc.submitFile(this.taskId, file).subscribe({
        next: () => {
          if (texto) {
            this.taskSvc.submitText(this.taskId, texto).subscribe({
              next: () => this.finishSuccess(),
              error: () => this.finishSuccess(),
            });
          } else {
            this.finishSuccess();
          }
        },
        error: () => {
          this.toastr.success('Error al subir el archivo', 'Éxito');
          this.sending.set(false);
        },
      });
      return;
    }

    this.taskSvc.submitText(this.taskId, texto).subscribe({
      next: () => this.finishSuccess(),
      error: () => {
        this.toastr.success('Error al entregar la tarea', 'Éxito');
        this.sending.set(false);
      },
    });
  }

  private finishSuccess() {
    this.toastr.success('Tarea entregada correctamente', 'Éxito');
    this.router.navigate(['/tareas']);
  }
}
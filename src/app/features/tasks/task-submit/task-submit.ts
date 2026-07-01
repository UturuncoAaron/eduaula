import {
  Component, inject, signal, computed,
  OnInit, OnDestroy, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe, Location } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TaskService } from '../data-access/task.store';
import { Task, Submission, tipoEntregaTarea } from '../../../core/models/task';
import { PageHeader } from '../../../shared/components/page-header/page-header';

export interface VistaPdf { tipo: 'pdf'; url: SafeResourceUrl }
export interface VistaImagen { tipo: 'imagen'; url: string }
export interface VistaOtro { tipo: 'otro'; nombre: string; extension: string; icono: string }
export type VistaArchivo = VistaPdf | VistaImagen | VistaOtro;

export interface ItemColapsable {
  id: string;
  titulo: string;
  tipo: string;
  url: string | null;
  storage_key: string | null;
  nombre_original: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  descripcion: string | null;
  expandido: boolean;
  vista: VistaArchivo | undefined;
  esLink: boolean;
}

export interface MaterialReferencia {
  id: string;
  titulo: string;
  tipo: string;
  url: string | null;
  storage_key: string | null;
  nombre_original: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  descripcion: string | null;
  bimestre: number | null;
  semana: number | null;
  orden: number;
}

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

export function resolverVista(nombre: string, url: string, sanitizer: DomSanitizer): VistaArchivo {
  const ext = extensionDe(nombre);
  if (ext === 'pdf') {
    return { tipo: 'pdf', url: sanitizer.bypassSecurityTrustResourceUrl(url) };
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    return { tipo: 'imagen', url };
  }
  return { tipo: 'otro', nombre, extension: ext.toUpperCase(), icono: iconoPorExtension(ext) };
}

export function toItemColapsable(
  id: string,
  titulo: string,
  tipo: string,
  url: string | null,
  storage_key: string | null,
  nombre_original: string | null,
  mime_type: string | null,
  size_bytes: number | null,
  descripcion: string | null,
  sanitizer: DomSanitizer,
): ItemColapsable {
  const esLink = !storage_key && !!url?.startsWith('http');
  let vista: VistaArchivo | undefined;
  if (!esLink && url) {
    vista = resolverVista(nombre_original ?? titulo, url, sanitizer);
  }
  return {
    id, titulo, tipo, url, storage_key,
    nombre_original, mime_type, size_bytes, descripcion,
    expandido: false, vista, esLink,
  };
}

@Component({
  selector: 'app-task-submit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, DatePipe,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatCardModule, MatProgressSpinnerModule,
    PageHeader,
  ],
  templateUrl: './task-submit.html',
  styleUrl: './task-submit.scss',
})
export class TaskSubmit implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private taskSvc = inject(TaskService);
  private toastr = inject(ToastService);
  private sanitizer = inject(DomSanitizer);

  taskId = this.route.snapshot.paramMap.get('id')!;

  task = signal<Task | null>(null);
  loading = signal(true);
  sending = signal(false);

  enunciado = signal<ItemColapsable | null>(null);
  materiales = signal<ItemColapsable[]>([]);
  entregaPrevia = signal<Submission | null>(null);
  vistaEntrega = signal<VistaArchivo | null>(null);
  entregaExpandida = signal(true);
  cargandoUrl = signal(false);
  selectedFile = signal<File | null>(null);
  vistaLocal = signal<VistaArchivo | null>(null);
  archivoExpandido = signal(true);
  private objectUrl: string | null = null;

  puedeTexto = computed(() => !!this.task()?.permite_texto);
  puedeArchivo = computed(() => !!this.task()?.permite_archivo);

  vencida = computed(() => {
    const t = this.task();
    if (!t) return false;
    return new Date() > new Date(t.fecha_limite);
  });

  yaEntrego = computed(() => !!this.entregaPrevia());
  calificada = computed(() => this.entregaPrevia()?.calificacion_final != null);

  form = this.fb.group({ respuesta_texto: [''] });

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

  get entregaPdf(): VistaPdf | null {
    const v = this.vistaEntrega();
    return v?.tipo === 'pdf' ? v : null;
  }
  get entregaImagen(): VistaImagen | null {
    const v = this.vistaEntrega();
    return v?.tipo === 'imagen' ? v : null;
  }
  get entregaOtro(): VistaOtro | null {
    const v = this.vistaEntrega();
    return v?.tipo === 'otro' ? v : null;
  }

  get localPdf(): VistaPdf | null {
    const v = this.vistaLocal();
    return v?.tipo === 'pdf' ? v : null;
  }
  get localImagen(): VistaImagen | null {
    const v = this.vistaLocal();
    return v?.tipo === 'imagen' ? v : null;
  }
  get localOtro(): VistaOtro | null {
    const v = this.vistaLocal();
    return v?.tipo === 'otro' ? v : null;
  }

  materialPdf(m: ItemColapsable): VistaPdf | null {
    return m.vista?.tipo === 'pdf' ? (m.vista as VistaPdf) : null;
  }
  materialImagen(m: ItemColapsable): VistaImagen | null {
    return m.vista?.tipo === 'imagen' ? (m.vista as VistaImagen) : null;
  }
  materialOtro(m: ItemColapsable): VistaOtro | null {
    return m.vista?.tipo === 'otro' ? (m.vista as VistaOtro) : null;
  }

  toggleEnunciado() {
    this.enunciado.update(e => e ? { ...e, expandido: !e.expandido } : e);
  }

  toggleMaterial(id: string) {
    this.materiales.update(list =>
      list.map(m => m.id === id ? { ...m, expandido: !m.expandido } : m),
    );
  }

  toggleEntrega() {
    this.entregaExpandida.update(v => !v);
  }

  toggleArchivo() {
    this.archivoExpandido.update(v => !v);
  }

  ngOnInit() {
    forkJoin({
      tarea: this.taskSvc.getTask(this.taskId),
      entrega: this.taskSvc.getMySubmission(this.taskId).pipe(catchError(() => of(null))),
      materiales: this.taskSvc.getMaterialesReferencia(this.taskId).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ tarea, entrega, materiales }) => {
        const t = tarea.data;
        this.task.set(t);

        if (tipoEntregaTarea(t) === 'interactiva') {
          this.location.back();
          return;
        }

        if (t.enunciado_storage_key || t.enunciado_url) {
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
              this.enunciado.set(item);
            },
            error: () => { },
          });
        }

        const lista: ItemColapsable[] = (materiales?.data ?? []).map(
          (m: MaterialReferencia) => toItemColapsable(
            m.id, m.titulo, m.tipo,
            m.url, m.storage_key, m.nombre_original,
            m.mime_type, m.size_bytes, m.descripcion,
            this.sanitizer,
          ),
        );
        this.materiales.set(lista);

        const e = entrega?.data ?? null;
        this.entregaPrevia.set(e);

        if (e) {
          if (e.respuesta_texto) {
            this.form.patchValue({ respuesta_texto: e.respuesta_texto });
          }
          if (e.storage_key && e.nombre_archivo) {
            this.cargandoUrl.set(true);
            this.taskSvc.getSubmissionFileUrl(e.id).subscribe({
              next: res => {
                this.vistaEntrega.set(
                  resolverVista(e.nombre_archivo ?? '', res.data.url, this.sanitizer),
                );
                this.cargandoUrl.set(false);
              },
              error: () => this.cargandoUrl.set(false),
            });
          }
        }

        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('No se pudo cargar la tarea', 'Error');
        this.loading.set(false);
        this.location.back();
      },
    });
  }

  ngOnDestroy() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    if (!file) { this.vistaLocal.set(null); return; }

    const ext = extensionDe(file.name);
    if (ext === 'pdf' || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      this.objectUrl = URL.createObjectURL(file);
      this.vistaLocal.set(resolverVista(file.name, this.objectUrl, this.sanitizer));
    } else {
      this.vistaLocal.set({
        tipo: 'otro',
        nombre: file.name,
        extension: ext.toUpperCase(),
        icono: iconoPorExtension(ext),
      });
    }
    this.archivoExpandido.set(true);
  }

  clearFile() {
    this.selectedFile.set(null);
    this.vistaLocal.set(null);
    if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
  }

  goBack() { this.location.back(); }

  submit() {
    if (this.sending() || this.vencida()) return;
    if (!this.task()) return;

    const texto = (this.form.value.respuesta_texto ?? '').trim();
    const file = this.selectedFile();

    if (!texto && !file) {
      this.toastr.warning('Debes escribir una respuesta o adjuntar un archivo', 'Aviso');
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
          this.toastr.error('Error al subir el archivo. Intenta de nuevo.', 'Error');
          this.sending.set(false);
        },
      });
      return;
    }

    this.taskSvc.submitText(this.taskId, texto).subscribe({
      next: () => this.finishSuccess(),
      error: () => {
        this.toastr.error('Error al entregar la tarea', 'Error');
        this.sending.set(false);
      },
    });
  }

  private finishSuccess() {
    this.toastr.success('Tarea entregada correctamente', 'Éxito');
    this.location.back();
  }

  formatBytes(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
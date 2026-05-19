// psicologa/informe-print/informe-print.ts
import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy,
  inject, signal, ElementRef, ViewChild,
} from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';
import { firstValueFrom } from 'rxjs';

import { PsychologyStore } from '../data-access/psychology.store';
import { ApiService } from '../../../core/services/api';
import {
  InformePsicologico, INFORME_TIPO_LABELS, AssignedStudent, ParentOfStudent,
} from '../../../core/models/psychology';

/**
 * Vista de impresión del informe psicológico.
 *
 * Al montar el componente agrega `informe-print-mode` al <body> para que
 * los estilos globales (@media print en styles.scss) puedan ocultar el
 * sidebar/navbar y dejar solo el documento al imprimir.
 *
 * "Subir al expediente": abre un file picker para que la psicóloga suba
 * el PDF que acaba de generar con "Guardar como PDF" del navegador.
 * El archivo se sube a POST /psychology/archivos/student/:id (categoria: ficha).
 */
@Component({
  selector: 'app-informe-print',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, TitleCasePipe,
    RouterLink,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './informe-print.html',
  styleUrl: './informe-print.scss',
})
export class InformePrint implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  private route = inject(ActivatedRoute);
  private store = inject(PsychologyStore);
  private api = inject(ApiService);
  private toastr = inject(ToastService);

  readonly informe = signal<InformePsicologico | null>(null);
  readonly student = signal<AssignedStudent | null>(null);
  readonly parents = signal<ParentOfStudent[]>([]);
  readonly firmaUrl = signal<string | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly uploading = signal(false);

  readonly tipoLabels = INFORME_TIPO_LABELS;

  // ── Ciclo de vida ────────────────────────────────────────────────

  ngOnInit(): void {
    // Marca el body → los @media print globales ocultan el sidebar
    document.body.classList.add('informe-print-mode');
    this.loadData();
  }

  ngOnDestroy(): void {
    document.body.classList.remove('informe-print-mode');
  }

  private async loadData() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Informe no encontrado');
      this.loading.set(false);
      return;
    }
    try {
      const informe = await this.store.getInformeById(id);
      this.informe.set(informe);

      const [stuRes, parentsRes, firmaRes] = await Promise.allSettled([
        firstValueFrom(
          this.api.get<AssignedStudent>(`users/alumnos/${informe.studentId}`),
        ),
        this.store.getStudentParents(informe.studentId),
        firstValueFrom(
          this.api.get<{ firmaUrl: string | null }>('psychology/firma'),
        ),
      ]);

      if (stuRes.status === 'fulfilled') this.student.set(stuRes.value.data ?? null);
      if (parentsRes.status === 'fulfilled') this.parents.set(parentsRes.value);
      if (firmaRes.status === 'fulfilled') this.firmaUrl.set(firmaRes.value.data?.firmaUrl ?? null);
    } catch {
      this.error.set('No se pudo cargar el informe');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Acciones ─────────────────────────────────────────────────────

  print(): void {
    window.print();
  }

  /** Abre el file picker para que la psicóloga suba el PDF generado. */
  openUploadPicker(): void {
    this.fileInputRef.nativeElement.value = '';
    this.fileInputRef.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const inf = this.informe();
    const stu = this.student();

    if (!file || !inf || !stu) return;
    if (file.type !== 'application/pdf') {
      this.toastr.error('Solo se aceptan archivos PDF', 'Formato inválido');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.toastr.error('El archivo no puede superar 10 MB', 'Archivo muy grande');
      return;
    }

    this.uploading.set(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('categoria', 'ficha');
      form.append('nombre', `Informe — ${inf.titulo}`);
      form.append('descripcion', `Generado desde el sistema · ${new Date().toLocaleDateString('es-PE')}`);

      await firstValueFrom(
        this.api.postForm(`psychology/archivos/student/${inf.studentId}`, form),
      );
      this.toastr.success('Informe subido al expediente del alumno');
    } catch {
      this.toastr.error('No se pudo subir el archivo', 'Error');
    } finally {
      this.uploading.set(false);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  studentFullName(s: AssignedStudent | null): string {
    if (!s) return '—';
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  parentFullName(p: ParentOfStudent): string {
    return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim();
  }
}
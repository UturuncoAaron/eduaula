// psicologa/informe-print/informe-print.ts
import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy,
  inject, signal,
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
 * Vista previa del informe psicológico + descarga del PDF.
 *
 * El PDF lo genera el backend (`GET /reports/psychology/informes/:id/pdf`)
 * y se descarga directamente como archivo, sin abrir el diálogo de
 * impresión del navegador. La vista en pantalla se mantiene como
 * referencia visual de cómo va a verse el documento final.
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
  private route = inject(ActivatedRoute);
  private store = inject(PsychologyStore);
  private api = inject(ApiService);
  private toastr = inject(ToastService);

  readonly informe = signal<InformePsicologico | null>(null);
  readonly student = signal<AssignedStudent | null>(null);
  readonly parents = signal<ParentOfStudent[]>([]);
  readonly firmaUrl = signal<string | null>(null);
  readonly loading = signal(true);
  readonly downloading = signal(false);
  readonly error = signal<string | null>(null);

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
          this.api.get<AssignedStudent>(
            `psychology/directory/students/${informe.studentId}`,
          ),
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

  /** Descarga el PDF generado por el backend, sin diálogo de impresión. */
  async downloadPdf(): Promise<void> {
    const inf = this.informe();
    if (!inf || this.downloading()) return;
    this.downloading.set(true);
    try {
      await this.store.downloadInformePdf(inf.id, inf.titulo);
      this.toastr.success('PDF descargado');
    } catch {
      this.toastr.error('No se pudo descargar el PDF', 'Error');
    } finally {
      this.downloading.set(false);
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

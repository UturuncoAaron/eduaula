import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy,
  inject, signal, computed,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';
import { firstValueFrom } from 'rxjs';

import { PsychologyStore } from '../data-access/psychology.store';
import { ApiService } from '../../../core/services/api';
import { InformePsicologico } from '../../../core/models/psychology';
import { PageHeader } from '../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-informe-print',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, PageHeader,
  ],
  templateUrl: './informe-print.html',
  styleUrl: './informe-print.scss',
})
export class InformePrint implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(PsychologyStore);
  private readonly api = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toastr = inject(ToastService);

  readonly informe = signal<InformePsicologico | null>(null);
  readonly loading = signal(true);
  readonly downloading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pdfUrl = signal<SafeResourceUrl | null>(null);

  readonly backRoute = computed(() => {
    const studentId = this.route.snapshot.paramMap.get('studentId');
    return studentId ? `/psicologa/student/${studentId}` : '/psicologa/alumnos';
  });

  ngOnInit(): void {
    void this.loadData();
  }

  ngOnDestroy(): void {
    const url = this.pdfUrl();
    if (url) URL.revokeObjectURL(url as string);
  }

  private async loadData(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Informe no encontrado');
      this.loading.set(false);
      return;
    }
    try {
      const informe = await this.store.getInformeById(id);
      this.informe.set(informe);

      const blob = await firstValueFrom(
        this.api.getBlob(`reports/psychology/informes/${id}/pdf/preview`),
      );
      const objectUrl = URL.createObjectURL(blob);
      this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl));
    } catch {
      this.error.set('No se pudo cargar el informe');
    } finally {
      this.loading.set(false);
    }
  }

  async downloadPdf(): Promise<void> {
    const inf = this.informe();
    if (!inf || this.downloading()) return;
    this.downloading.set(true);
    try {
      await this.store.downloadInformePdf(inf.id, inf.motivoConsultaCorto ?? 'informe');
      this.toastr.success('PDF descargado');
    } catch {
      this.toastr.error('No se pudo descargar el PDF', 'Error');
    } finally {
      this.downloading.set(false);
    }
  }
}
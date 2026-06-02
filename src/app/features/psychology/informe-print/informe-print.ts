import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy,
  inject, signal, computed,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';
import { firstValueFrom } from 'rxjs';

import { PsychologyStore } from '../data-access/psychology.store';
import { ApiService } from '../../../core/services/api';
import { InformePsicologico, AssignedStudent } from '../../../core/models/psychology';

interface PsicologaData {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  colegiatura: string | null;
}

@Component({
  selector: 'app-informe-print',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, RouterLink,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './informe-print.html',
  styleUrl: './informe-print.scss',
})
export class InformePrint implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(PsychologyStore);
  private readonly api = inject(ApiService);
  private readonly toastr = inject(ToastService);

  readonly informe = signal<InformePsicologico | null>(null);
  readonly student = signal<AssignedStudent | null>(null);
  readonly firmaUrl = signal<string | null>(null);
  readonly loading = signal(true);
  readonly downloading = signal(false);
  readonly error = signal<string | null>(null);

  private readonly psicologaData = signal<PsicologaData | null>(null);

  readonly psicologaFullName = computed(() => {
    const p = this.psicologaData();
    if (!p) return '—';
    return [p.nombre, p.apellido_paterno, p.apellido_materno ?? '']
      .filter(Boolean).join(' ');
  });

  readonly psicologaColegiatura = computed(() =>
    this.psicologaData()?.colegiatura ?? null,
  );

  ngOnInit(): void {
    void this.loadData();
  }

  ngOnDestroy(): void { /* cleanup si se necesita */ }

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

      const [stuRes, firmaRes, psicRes] = await Promise.allSettled([
        firstValueFrom(
          this.api.get<AssignedStudent>(
            `psychology/directory/students/${informe.studentId}`,
          ),
        ),
        firstValueFrom(
          this.api.get<{ firmaUrl: string | null }>('psychology/firma'),
        ),
        firstValueFrom(
          this.api.get<PsicologaData>('psychology/me'),
        ),
      ]);

      if (stuRes.status === 'fulfilled') this.student.set(stuRes.value.data ?? null);
      if (firmaRes.status === 'fulfilled') this.firmaUrl.set(firmaRes.value.data?.firmaUrl ?? null);
      if (psicRes.status === 'fulfilled') this.psicologaData.set(psicRes.value.data ?? null);
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
      const studentName = this.student()
        ? `${this.student()!.apellido_paterno}_${this.student()!.nombre}`
        : 'informe';
      await this.store.downloadInformePdf(inf.id, studentName);
      this.toastr.success('PDF descargado');
    } catch {
      this.toastr.error('No se pudo descargar el PDF', 'Error');
    } finally {
      this.downloading.set(false);
    }
  }

  studentFullName(s: AssignedStudent | null): string {
    if (!s) return '—';
    return [s.nombre, s.apellido_paterno, s.apellido_materno ?? '']
      .filter(Boolean).join(' ');
  }
}
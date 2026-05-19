// psicologa/informe-print/informe-print.ts
import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy,
  inject, signal, computed,
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

  // Datos de la psicóloga (para el footer)
  private readonly psicologaData = signal<{
    nombre: string; apellido_paterno: string;
    apellido_materno: string | null; colegiatura: string | null;
  } | null>(null);

  readonly tipoLabels = INFORME_TIPO_LABELS;

  // ── Derivados ───────────────────────────────────────────────────

  readonly studentAge = computed(() => {
    const s = this.student();
    if (!s?.fecha_nacimiento) return null;
    const birth = new Date(s.fecha_nacimiento);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  });

  readonly psicologaFullName = computed(() => {
    const p = this.psicologaData();
    if (!p) return '—';
    return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim();
  });

  readonly psicologaColegiatura = computed(() => this.psicologaData()?.colegiatura ?? null);

  // ── Ciclo de vida ───────────────────────────────────────────────

  ngOnInit(): void {
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

      const [stuRes, parentsRes, firmaRes, psicRes] = await Promise.allSettled([
        firstValueFrom(
          this.api.get<AssignedStudent>(
            `psychology/directory/students/${informe.studentId}`,
          ),
        ),
        this.store.getStudentParents(informe.studentId),
        firstValueFrom(
          this.api.get<{ firmaUrl: string | null }>('psychology/firma'),
        ),
        firstValueFrom(
          this.api.get<{ nombre: string; apellido_paterno: string; apellido_materno: string | null; colegiatura: string | null }>(
            'psychology/me',
          ),
        ),
      ]);

      if (stuRes.status === 'fulfilled') this.student.set(stuRes.value.data ?? null);
      if (parentsRes.status === 'fulfilled') this.parents.set(parentsRes.value);
      if (firmaRes.status === 'fulfilled') this.firmaUrl.set(firmaRes.value.data?.firmaUrl ?? null);
      if (psicRes.status === 'fulfilled') this.psicologaData.set(psicRes.value.data ?? null);
    } catch {
      this.error.set('No se pudo cargar el informe');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Acciones ────────────────────────────────────────────────────

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

  // ── Helpers ─────────────────────────────────────────────────────

  studentFullName(s: AssignedStudent | null): string {
    if (!s) return '—';
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  parentFullName(p: ParentOfStudent): string {
    return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim();
  }
}
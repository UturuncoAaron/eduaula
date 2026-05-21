import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from 'ngx-toastr-notifier';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '@core/services/api';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { RecordFormDialog } from '../dialogs/record-form-dialog/record-form-dialog';
import { InformeFormDialog } from '../dialogs/informe-form-dialog/informe-form-dialog';
import {
  ArchivoUploadDialog,
  type ArchivoUploadDialogData,
} from '../dialogs/archivo-upload-dialog/archivo-upload-dialog';
import {
  type PsychologyRecord as _PsychologyRecord,
  type InformePsicologico as _InformePsicologico,
  type ArchivoPsicologico as _ArchivoPsicologico,
  type ArchivoCategoria,
} from '../../../core/models/psychology';

// ─── Extensiones locales (citaId llegó con migración v7) ─────────
// Agregar citaId a core/models/psychology.ts elimina estos aliases.
export type PsychologyRecord = _PsychologyRecord & { citaId?: string | null };
export type InformePsicologico = _InformePsicologico & { citaId?: string | null };
export type ArchivoPsicologico = _ArchivoPsicologico & { citaId?: string | null };

// Record<string,string> para que el template pueda indexar con tipo dinámico
const INFORME_TIPO_LABELS: Record<string, string> = {
  evaluacion: 'Evaluación',
  seguimiento: 'Seguimiento',
  derivacion_familia: 'Derivación familia',
  derivacion_externa: 'Derivación externa',
};

// ─── Interfaces ──────────────────────────────────────────────────

interface StudentProfile {
  id: string;
  codigoEstudiante: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  fotoUrl: string | null;
  grado: { nombre: string; orden: number } | null;
  seccion: { nombre: string } | null;
  enSeguimiento: boolean;
  desde: string | null;
}

interface CitaRow {
  id: string;
  motivo: string;
  tipo: string;
  modalidad: string;
  estado: string;
  scheduledAt: string;
  durationMin: number;
  priorNotes: string | null;
  followUpNotes: string | null;
}

interface CitaDetail {
  fichas: PsychologyRecord[];
  archivos: ArchivoPsicologico[];
  informe: InformePsicologico | null;
  loading: boolean;
  loaded: boolean;
}

// ─── Constantes ──────────────────────────────────────────────────

const TAB_CITAS = 3;

const CITA_TIPO_LABELS: Record<string, string | undefined> = {
  academico: 'Académico', conductual: 'Conductual', psicologico: 'Psicológico',
  familiar: 'Familiar', disciplinario: 'Disciplinario', otro: 'Otro',
};

const CITA_ESTADO_LABELS: Record<string, string | undefined> = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', realizada: 'Realizada',
  cancelada: 'Cancelada', no_asistio: 'No asistió', rechazada: 'Rechazada',
};

// ─── Componente ──────────────────────────────────────────────────

@Component({
  selector: 'app-student-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, NgTemplateOutlet, RouterLink,
    MatButtonModule, MatIconModule, MatTabsModule, MatExpansionModule,
    MatProgressSpinnerModule, MatTooltipModule,
    EmptyState,
  ],
  templateUrl: './student-detail.html',
  styleUrls: ['./student-detail.scss'],
})
export class StudentDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly toastr = inject(ToastService);
  private readonly api = inject(ApiService);

  readonly studentId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');

  // ── Perfil ────────────────────────────────────────────────────
  readonly profile = signal<StudentProfile | null>(null);
  readonly loadingProfile = signal(true);

  // ── Tabs — tab 0 carga en ngOnInit ───────────────────────────
  readonly tabVisited = signal([true, false, false, false]);

  // ── Datos por sección (todos con sinCita=true) ────────────────
  readonly fichas = signal<PsychologyRecord[]>([]);
  readonly loadingFichas = signal(false);
  readonly informes = signal<InformePsicologico[]>([]);
  readonly loadingInformes = signal(false);
  readonly fichaArchivos = signal<ArchivoPsicologico[]>([]);
  readonly testArchivos = signal<ArchivoPsicologico[]>([]);
  readonly loadingArchivos = signal(false);

  // ── Citas ─────────────────────────────────────────────────────
  readonly citas = signal<CitaRow[]>([]);
  readonly loadingCitas = signal(false);
  readonly totalCitas = signal(0);

  // ── Detalle por cita (lazy al abrir el acordeón) ──────────────
  readonly citaDetails = signal<Map<string, CitaDetail>>(new Map());

  // ── Labels expuestos al template ─────────────────────────────
  readonly tipoLabels = INFORME_TIPO_LABELS;
  readonly citaTipoLabels = CITA_TIPO_LABELS;
  readonly citaEstadoLabels = CITA_ESTADO_LABELS;

  // ── Counts ───────────────────────────────────────────────────
  readonly fichasCount = computed(() => this.fichas().length);
  readonly informesCount = computed(() => this.informes().length);
  readonly informesFinalizadosCount = computed(
    () => this.informes().filter(i => i.estado === 'finalizado').length,
  );
  readonly fichasArchivosCount = computed(() => this.fichaArchivos().length);
  readonly testsArchivosCount = computed(() => this.testArchivos().length);
  readonly totalArchivos = computed(
    () => this.fichasArchivosCount() + this.testsArchivosCount(),
  );

  // ════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ════════════════════════════════════════════════════════════

  ngOnInit(): void {
    const id = this.studentId();
    if (!id) return;
    void this.loadProfile(id);
    void this.loadFichas(id);
  }

  // ════════════════════════════════════════════════════════════
  // CARGA DE DATOS
  // ════════════════════════════════════════════════════════════

  private async loadProfile(id: string): Promise<void> {
    this.loadingProfile.set(true);
    try {
      const res = await firstValueFrom(this.api.get<any>(`psychology/student/${id}/profile`));
      this.profile.set(res.data ?? res);
    } catch {
      this.toastr.error('No se pudo cargar el perfil del alumno', 'Error');
    } finally {
      this.loadingProfile.set(false);
    }
  }

  private async loadFichas(id: string): Promise<void> {
    this.loadingFichas.set(true);
    try {
      const res = await firstValueFrom(
        this.api.get<any>(`psychology/records/student/${id}?sinCita=true&limit=100`),
      );
      this.fichas.set(this.toArr(res));
    } catch {
      this.toastr.error('Error al cargar fichas', 'Error');
    } finally {
      this.loadingFichas.set(false);
    }
  }

  private async loadInformes(id: string): Promise<void> {
    this.loadingInformes.set(true);
    try {
      const res = await firstValueFrom(
        this.api.get<any>(`psychology/informes/student/${id}?sinCita=true&limit=100`),
      );
      this.informes.set(this.toArr(res));
    } catch {
      this.toastr.error('Error al cargar informes', 'Error');
    } finally {
      this.loadingInformes.set(false);
    }
  }

  private async loadArchivos(id: string): Promise<void> {
    this.loadingArchivos.set(true);
    try {
      const [fichasRes, testsRes] = await Promise.all([
        firstValueFrom(this.api.get<any>(`psychology/archivos/student/${id}?sinCita=true&categoria=ficha&limit=100`)),
        firstValueFrom(this.api.get<any>(`psychology/archivos/student/${id}?sinCita=true&categoria=test&limit=100`)),
      ]);
      this.fichaArchivos.set(this.toArr(fichasRes));
      this.testArchivos.set(this.toArr(testsRes));
    } catch {
      this.toastr.error('Error al cargar archivos', 'Error');
    } finally {
      this.loadingArchivos.set(false);
    }
  }

  private async loadCitas(id: string): Promise<void> {
    this.loadingCitas.set(true);
    try {
      const res = await firstValueFrom(
        this.api.get<any>(`appointments/student/${id}?page=1&limit=50&order=DESC`),
      );
      const b = res.data ?? res;
      this.citas.set(b.data ?? []);
      this.totalCitas.set(b.total ?? 0);
    } catch {
      this.toastr.error('Error al cargar las citas', 'Error');
    } finally {
      this.loadingCitas.set(false);
    }
  }

  // ════════════════════════════════════════════════════════════
  // TABS — lazy loading
  // ════════════════════════════════════════════════════════════

  onTabChange(index: number): void {
    const visited = [...this.tabVisited()];
    if (!visited[index]) {
      visited[index] = true;
      this.tabVisited.set(visited);
    }
    const id = this.studentId();
    if (index === 1 && !this.loadingInformes() && this.informes().length === 0)
      void this.loadInformes(id);
    if (index === 2 && !this.loadingArchivos() && this.totalArchivos() === 0)
      void this.loadArchivos(id);
    if (index === TAB_CITAS && !this.loadingCitas() && this.citas().length === 0)
      void this.loadCitas(id);
  }

  // ════════════════════════════════════════════════════════════
  // ACORDEÓN — detalle por cita
  // ════════════════════════════════════════════════════════════

  async onCitaExpand(cita: CitaRow): Promise<void> {
    if (cita.estado !== 'realizada') return;
    if (this.citaDetails().get(cita.id)?.loaded) return;

    const m1 = new Map(this.citaDetails());
    m1.set(cita.id, { fichas: [], archivos: [], informe: null, loading: true, loaded: false });
    this.citaDetails.set(m1);

    const id = this.studentId();
    try {
      const [fRes, aRes, iRes] = await Promise.all([
        firstValueFrom(this.api.get<any>(`psychology/records/student/${id}?citaId=${cita.id}&limit=50`)),
        firstValueFrom(this.api.get<any>(`psychology/archivos/student/${id}?citaId=${cita.id}&limit=50`)),
        firstValueFrom(this.api.get<any>(`psychology/informes/student/${id}?citaId=${cita.id}&limit=1`)),
      ]);
      const m2 = new Map(this.citaDetails());
      m2.set(cita.id, {
        fichas: this.toArr(fRes),
        archivos: this.toArr(aRes),
        informe: (this.toArr(iRes)[0] as InformePsicologico | undefined) ?? null,
        loading: false, loaded: true,
      });
      this.citaDetails.set(m2);
    } catch {
      const m2 = new Map(this.citaDetails());
      m2.set(cita.id, { fichas: [], archivos: [], informe: null, loading: false, loaded: true });
      this.citaDetails.set(m2);
      this.toastr.error('Error al cargar el contenido de la sesión', 'Error');
    }
  }

  getCitaDetail(citaId: string): CitaDetail {
    return this.citaDetails().get(citaId) ??
    { fichas: [], archivos: [], informe: null, loading: false, loaded: false };
  }

  // ════════════════════════════════════════════════════════════
  // HELPERS DE PRESENTACIÓN
  // ════════════════════════════════════════════════════════════

  fullName(p: StudentProfile | null): string {
    if (!p) return '';
    return `${p.nombre} ${p.apellidoPaterno}${p.apellidoMaterno ? ' ' + p.apellidoMaterno : ''}`;
  }

  initials(p: StudentProfile | null): string {
    if (!p) return '?';
    return `${p.nombre[0] ?? ''}${p.apellidoPaterno[0] ?? ''}`.toUpperCase();
  }

  gradoLabel(p: StudentProfile): string {
    if (!p.grado) return 'Sin matrícula';
    return `${p.grado.nombre}${p.seccion ? ' — Sección ' + p.seccion.nombre : ''}`;
  }

  esFuturaOPendiente(c: CitaRow): boolean {
    return ['pendiente', 'confirmada'].includes(c.estado);
  }

  esCancelada(c: CitaRow): boolean {
    return ['cancelada', 'no_asistio', 'rechazada'].includes(c.estado);
  }

  archivoIcon(a: ArchivoPsicologico): string {
    const mime = (a.mimeType ?? '').toLowerCase();
    const ext = (a.nombreOriginal ?? '').split('.').pop()?.toLowerCase() ?? '';
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf' || ext === 'pdf') return 'picture_as_pdf';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'table_chart';
    if (['doc', 'docx'].includes(ext)) return 'description';
    if (['zip', 'rar', '7z'].includes(ext)) return 'folder_zip';
    return 'insert_drive_file';
  }

  archivoSize(a: ArchivoPsicologico): string {
    const b = a.sizeBytes ?? 0;
    if (!b) return '—';
    if (b < 1_024) return `${b} B`;
    if (b < 1_048_576) return `${(b / 1_024).toFixed(1)} KB`;
    return `${(b / 1_048_576).toFixed(2)} MB`;
  }

  // ════════════════════════════════════════════════════════════
  // FICHAS
  // ════════════════════════════════════════════════════════════

  openCreateRecord(citaId?: string): void {
    const p = this.profile();
    if (!p) return;
    this.dialog.open(RecordFormDialog, {
      width: '560px', maxWidth: '95vw',
      data: { studentId: p.id, studentName: this.fullName(p), citaId },
    }).afterClosed().subscribe((ok) => {
      if (!ok) return;
      citaId ? this.reloadCitaDetail(citaId) : void this.loadFichas(p.id);
    });
  }

  openEditRecord(record: PsychologyRecord): void {
    const p = this.profile();
    if (!p) return;
    this.dialog.open(RecordFormDialog, {
      width: '560px', maxWidth: '95vw',
      data: { studentId: p.id, studentName: this.fullName(p), record },
    }).afterClosed().subscribe((ok) => {
      if (!ok) return;
      record.citaId ? this.reloadCitaDetail(record.citaId) : void this.loadFichas(p.id);
    });
  }

  deleteRecord(record: PsychologyRecord): void {
    this.dialog.open(ConfirmDialog, {
      width: '420px',
      data: { title: 'Eliminar ficha', message: '¿Seguro que deseas eliminar esta ficha?', confirm: 'Eliminar', cancel: 'Cancelar', danger: true },
    }).afterClosed().subscribe(async (ok) => {
      if (!ok) return;
      try {
        await firstValueFrom(this.api.delete<any>(`psychology/records/${record.id}`));
        this.toastr.success('Ficha eliminada');
        record.citaId ? this.reloadCitaDetail(record.citaId) : void this.loadFichas(this.studentId());
      } catch { this.toastr.error('No se pudo eliminar la ficha', 'Error'); }
    });
  }

  // ════════════════════════════════════════════════════════════
  // INFORMES
  // ════════════════════════════════════════════════════════════

  openCreateInforme(citaId?: string): void {
    const p = this.profile();
    if (!p) return;
    this.dialog.open(InformeFormDialog, {
      width: '720px', maxWidth: '95vw',
      data: { studentId: p.id, studentName: this.fullName(p), citaId },
    }).afterClosed().subscribe((ok) => {
      if (!ok) return;
      citaId ? this.reloadCitaDetail(citaId) : void this.loadInformes(p.id);
    });
  }

  openEditInforme(informe: InformePsicologico): void {
    const p = this.profile();
    if (!p) return;
    this.dialog.open(InformeFormDialog, {
      width: '720px', maxWidth: '95vw',
      data: { studentId: p.id, studentName: this.fullName(p), informe },
    }).afterClosed().subscribe((ok) => {
      if (!ok) return;
      informe.citaId ? this.reloadCitaDetail(informe.citaId) : void this.loadInformes(p.id);
    });
  }

  finalizeInforme(informe: InformePsicologico): void {
    this.dialog.open(ConfirmDialog, {
      width: '460px',
      data: { title: 'Finalizar informe', message: 'Al finalizar no podrás editar el informe. ¿Continuar?', confirm: 'Finalizar', cancel: 'Cancelar' },
    }).afterClosed().subscribe(async (ok) => {
      if (!ok) return;
      try {
        await firstValueFrom(this.api.post<any>(`psychology/informes/${informe.id}/finalizar`, {}));
        this.toastr.success('Informe finalizado');
        informe.citaId ? this.reloadCitaDetail(informe.citaId) : void this.loadInformes(this.studentId());
      } catch { this.toastr.error('No se pudo finalizar el informe', 'Error'); }
    });
  }

  deleteInforme(informe: InformePsicologico): void {
    this.dialog.open(ConfirmDialog, {
      width: '420px',
      data: { title: 'Eliminar informe', message: '¿Seguro que deseas eliminar este informe?', confirm: 'Eliminar', cancel: 'Cancelar', danger: true },
    }).afterClosed().subscribe(async (ok) => {
      if (!ok) return;
      try {
        await firstValueFrom(this.api.delete<any>(`psychology/informes/${informe.id}`));
        this.toastr.success('Informe eliminado');
        informe.citaId ? this.reloadCitaDetail(informe.citaId) : void this.loadInformes(this.studentId());
      } catch { this.toastr.error('No se pudo eliminar el informe', 'Error'); }
    });
  }

  // ════════════════════════════════════════════════════════════
  // ARCHIVOS
  // ════════════════════════════════════════════════════════════

  openUploadArchivo(categoria: ArchivoCategoria, citaId?: string): void {
    const p = this.profile();
    if (!p) return;
    this.dialog.open(ArchivoUploadDialog, {
      width: '600px', maxWidth: '95vw', autoFocus: false,
      data: { studentId: p.id, studentName: this.fullName(p), categoria, citaId } as ArchivoUploadDialogData & { citaId?: string },
    }).afterClosed().subscribe((ok) => {
      if (!ok) return;
      citaId ? this.reloadCitaDetail(citaId) : void this.loadArchivos(p.id);
    });
  }

  async downloadArchivo(a: ArchivoPsicologico): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.api.get<{ url: string }>(`psychology/archivos/${a.id}/url`),
      );
      window.open(res.data.url, '_blank', 'noopener');
    } catch { this.toastr.error('No se pudo generar el enlace de descarga', 'Error'); }
  }

  deleteArchivo(a: ArchivoPsicologico): void {
    const label = a.categoria === 'ficha' ? 'ficha' : 'test';
    this.dialog.open(ConfirmDialog, {
      width: '440px',
      data: { title: `Eliminar ${label}`, message: `¿Seguro que deseas eliminar "${a.nombre}"?`, confirm: 'Eliminar', cancel: 'Cancelar', danger: true },
    }).afterClosed().subscribe(async (ok) => {
      if (!ok) return;
      try {
        await firstValueFrom(this.api.delete<any>(`psychology/archivos/${a.id}`));
        this.toastr.success(`${label.charAt(0).toUpperCase() + label.slice(1)} eliminada`);
        a.citaId ? this.reloadCitaDetail(a.citaId) : void this.loadArchivos(this.studentId());
      } catch { this.toastr.error(`No se pudo eliminar el ${label}`, 'Error'); }
    });
  }

  // ════════════════════════════════════════════════════════════
  // NUEVA CITA — AppointmentFormDialog (dialog de psicóloga)
  // ════════════════════════════════════════════════════════════

  async openNuevaCita(): Promise<void> {
    const p = this.profile();
    if (!p) return;
    const { AppointmentFormDialog } = await import(
      '../dialogs/appointment-form-dialog/appointment-form-dialog'
    );
    // Usar `as any` hasta que AppointmentFormDialogData incluya alumnoFijo/alumnoId
    this.dialog.open(AppointmentFormDialog, {
      panelClass: 'afd-panel',
      autoFocus: 'first-tabbable',
      data: {
        alumnoId: p.id,
        alumnoNombre: this.fullName(p),
        alumnoFijo: true,
      } as any,
    }).afterClosed().subscribe((ok: boolean) => {
      if (ok && this.tabVisited()[TAB_CITAS]) void this.loadCitas(this.studentId());
    });
  }

  // ════════════════════════════════════════════════════════════
  // MARCAR CITA REALIZADA
  // ════════════════════════════════════════════════════════════

  marcarRealizada(cita: CitaRow): void {
    const fechaLabel = new Date(cita.scheduledAt).toLocaleDateString('es-PE', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    this.dialog.open(ConfirmDialog, {
      width: '440px',
      data: { title: 'Marcar como realizada', message: `¿Confirmas que la cita del ${fechaLabel} fue realizada?`, confirm: 'Confirmar', cancel: 'Cancelar' },
    }).afterClosed().subscribe(async (ok) => {
      if (!ok) return;
      try {
        await firstValueFrom(this.api.patch<any>(`appointments/${cita.id}/realizar`, {}));
        this.toastr.success('Cita marcada como realizada');
        void this.loadCitas(this.studentId());
      } catch { this.toastr.error('No se pudo actualizar la cita', 'Error'); }
    });
  }

  // ════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS
  // ════════════════════════════════════════════════════════════

  /** Extrae array de cualquier shape de respuesta de la API. */
  private toArr<T>(res: any): T[] {
    const b = res?.data ?? res;
    return Array.isArray(b) ? b : (b?.data ?? []);
  }

  /** Invalida el detalle de una cita y lo recarga. */
  private reloadCitaDetail(citaId: string): void {
    const m = new Map(this.citaDetails());
    m.delete(citaId);
    this.citaDetails.set(m);
    const cita = this.citas().find(c => c.id === citaId);
    if (cita) void this.onCitaExpand(cita);
  }
}
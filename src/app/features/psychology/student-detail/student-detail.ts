import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
  type PsychologyRecord,
  type InformePsicologico,
  type ArchivoPsicologico,
  type ArchivoCategoria,
} from '../../../core/models/psychology';

const INFORME_TIPO_LABELS: Record<string, string> = {
  evaluacion: 'Evaluación psicológica',
  seguimiento: 'Reporte de seguimiento',
  derivacion_familia: 'Derivación a la familia',
  derivacion_externa: 'Derivación a especialista externo',
};

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
  anotaciones: PsychologyRecord[];
  archivos: ArchivoPsicologico[];
  informe: InformePsicologico | null;
  loading: boolean;
  loaded: boolean;
}

const TAB_TESTS = 1;
const TAB_INFORMES = 2;
const TAB_CITAS = 3;

const CITA_TIPO_LABELS: Record<string, string | undefined> = {
  academico: 'Académico', conductual: 'Conductual', psicologico: 'Psicológico',
  familiar: 'Familiar', disciplinario: 'Disciplinario', otro: 'Otro',
};

const CITA_ESTADO_LABELS: Record<string, string | undefined> = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', realizada: 'Realizada',
  cancelada: 'Cancelada', no_asistio: 'No asistió', rechazada: 'Rechazada',
};

@Component({
  selector: 'app-student-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
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
  private readonly sanitizer = inject(DomSanitizer);

  readonly studentId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');

  readonly profile = signal<StudentProfile | null>(null);
  readonly loadingProfile = signal(true);
  readonly tabVisited = signal([true, false, false, false]);
  readonly fichaArchivos = signal<ArchivoPsicologico[]>([]);
  readonly loadingFichas = signal(false);
  readonly testArchivos = signal<ArchivoPsicologico[]>([]);
  readonly loadingTests = signal(false);
  readonly informesGenerados = signal<InformePsicologico[]>([]);
  readonly informesSubidos = signal<ArchivoPsicologico[]>([]);
  readonly loadingInformes = signal(false);
  readonly citas = signal<CitaRow[]>([]);
  readonly loadingCitas = signal(false);
  readonly totalCitas = signal(0);
  readonly citaDetails = signal<Map<string, CitaDetail>>(new Map());
  readonly previewUrls = signal<Map<string, string>>(new Map());
  readonly previewLoading = signal<Set<string>>(new Set());

  readonly tipoLabels = INFORME_TIPO_LABELS;
  readonly citaTipoLabels = CITA_TIPO_LABELS;
  readonly citaEstadoLabels = CITA_ESTADO_LABELS;

  readonly fichasCount = computed(() => this.fichaArchivos().length);
  readonly testsCount = computed(() => this.testArchivos().length);
  readonly informesCount = computed(
    () => this.informesGenerados().length + this.informesSubidos().length,
  );
  readonly informesFinalizadosCount = computed(
    () => this.informesGenerados().filter(i => i.estado === 'finalizado').length,
  );

  ngOnInit(): void {
    const id = this.studentId();
    if (!id) return;
    void this.loadProfile(id);
    void this.loadFichas(id);
  }

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
        this.api.get<any>(`psychology/archivos/student/${id}?sinCita=true&categoria=ficha&limit=100`),
      );
      this.fichaArchivos.set(this.toArr(res));
    } catch {
      this.toastr.error('Error al cargar fichas', 'Error');
    } finally {
      this.loadingFichas.set(false);
    }
  }

  private async loadTests(id: string): Promise<void> {
    this.loadingTests.set(true);
    try {
      const res = await firstValueFrom(
        this.api.get<any>(`psychology/archivos/student/${id}?sinCita=true&categoria=test&limit=100`),
      );
      this.testArchivos.set(this.toArr(res));
    } catch {
      this.toastr.error('Error al cargar tests', 'Error');
    } finally {
      this.loadingTests.set(false);
    }
  }

  private async loadInformes(id: string): Promise<void> {
    this.loadingInformes.set(true);
    try {
      const [generadosRes, subidosRes] = await Promise.all([
        firstValueFrom(this.api.get<any>(`psychology/informes/student/${id}?sinCita=true&limit=100`)),
        firstValueFrom(this.api.get<any>(`psychology/archivos/student/${id}?sinCita=true&categoria=informe&limit=100`)),
      ]);
      this.informesGenerados.set(this.toArr(generadosRes));
      this.informesSubidos.set(this.toArr(subidosRes));
    } catch {
      this.toastr.error('Error al cargar informes', 'Error');
    } finally {
      this.loadingInformes.set(false);
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

  onTabChange(index: number): void {
    const visited = [...this.tabVisited()];
    if (!visited[index]) {
      visited[index] = true;
      this.tabVisited.set(visited);
    }
    const id = this.studentId();
    if (index === TAB_TESTS && !this.loadingTests() && !this.testArchivos().length)
      void this.loadTests(id);
    if (index === TAB_INFORMES && !this.loadingInformes() && !this.informesCount())
      void this.loadInformes(id);
    if (index === TAB_CITAS && !this.loadingCitas() && !this.citas().length)
      void this.loadCitas(id);
  }

  async onCitaExpand(cita: CitaRow): Promise<void> {
    if (cita.estado !== 'realizada') return;
    if (this.citaDetails().get(cita.id)?.loaded) return;

    const m1 = new Map(this.citaDetails());
    m1.set(cita.id, { anotaciones: [], archivos: [], informe: null, loading: true, loaded: false });
    this.citaDetails.set(m1);

    const id = this.studentId();
    try {
      const [anotRes, archRes, infRes] = await Promise.all([
        firstValueFrom(this.api.get<any>(`psychology/records/student/${id}?citaId=${cita.id}&limit=50`)),
        firstValueFrom(this.api.get<any>(`psychology/archivos/student/${id}?citaId=${cita.id}&limit=50`)),
        firstValueFrom(this.api.get<any>(`psychology/informes/student/${id}?citaId=${cita.id}&limit=1`)),
      ]);
      const m2 = new Map(this.citaDetails());
      m2.set(cita.id, {
        anotaciones: this.toArr<PsychologyRecord>(anotRes),
        archivos: this.toArr<ArchivoPsicologico>(archRes),
        informe: (this.toArr<InformePsicologico>(infRes)[0]) ?? null,
        loading: false, loaded: true,
      });
      this.citaDetails.set(m2);
    } catch {
      const m2 = new Map(this.citaDetails());
      m2.set(cita.id, { anotaciones: [], archivos: [], informe: null, loading: false, loaded: true });
      this.citaDetails.set(m2);
      this.toastr.error('Error al cargar el contenido de la sesión', 'Error');
    }
  }

  getCitaDetail(citaId: string): CitaDetail {
    return this.citaDetails().get(citaId) ??
    { anotaciones: [], archivos: [], informe: null, loading: false, loaded: false };
  }

  isPreviewing(archivoId: string): boolean {
    return this.previewUrls().has(archivoId);
  }

  isPreviewable(a: ArchivoPsicologico): boolean {
    const mime = (a.mimeType ?? '').toLowerCase();
    const ext = (a.nombreOriginal ?? '').split('.').pop()?.toLowerCase() ?? '';
    return mime.startsWith('image/') || mime === 'application/pdf' || ext === 'pdf';
  }

  isImage(a: ArchivoPsicologico): boolean {
    return (a.mimeType ?? '').startsWith('image/');
  }

  safePreviewUrl(archivoId: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      this.previewUrls().get(archivoId) ?? '',
    );
  }

  async togglePreview(a: ArchivoPsicologico): Promise<void> {
    const current = new Map(this.previewUrls());
    if (current.has(a.id)) {
      current.delete(a.id);
      this.previewUrls.set(current);
      return;
    }
    const loading = new Set(this.previewLoading());
    loading.add(a.id);
    this.previewLoading.set(loading);
    try {
      const res = await firstValueFrom(
        this.api.get<{ url: string }>(`psychology/archivos/${a.id}/preview-url`),
      );

      let previewUrl = res.data.url;

      // Detectar si el archivo es un PDF
      const isPdf = (a.mimeType ?? '').toLowerCase() === 'application/pdf' ||
        (a.nombreOriginal ?? '').toLowerCase().endsWith('.pdf');

      // Si es PDF, agregamos los parámetros para ocultar el panel lateral y ajustar el ancho
      if (isPdf) {
        previewUrl += previewUrl.includes('#') ? '&navpanes=0&view=FitH' : '#navpanes=0&view=FitH';
      }

      const m = new Map(this.previewUrls());
      m.set(a.id, previewUrl);
      this.previewUrls.set(m);
    } catch {
      this.toastr.error('No se pudo cargar la previsualización', 'Error');
    } finally {
      const l = new Set(this.previewLoading());
      l.delete(a.id);
      this.previewLoading.set(l);
    }
  }
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

  openUploadArchivo(categoria: ArchivoCategoria, citaId?: string): void {
    const p = this.profile();
    if (!p) return;
    this.dialog.open(ArchivoUploadDialog, {
      width: '600px', maxWidth: '95vw', autoFocus: false,
      data: { studentId: p.id, studentName: this.fullName(p), categoria, citaId } as ArchivoUploadDialogData & { citaId?: string },
    }).afterClosed().subscribe((ok) => {
      if (!ok) return;
      if (citaId) { this.reloadCitaDetail(citaId); return; }
      if (categoria === 'ficha') void this.loadFichas(p.id);
      if (categoria === 'test') void this.loadTests(p.id);
      if (categoria === 'informe') void this.loadInformes(p.id);
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

  deleteArchivo(a: ArchivoPsicologico, reloadTab: 'fichas' | 'tests' | 'informes'): void {
    this.dialog.open(ConfirmDialog, {
      width: '440px',
      data: { title: 'Eliminar archivo', message: `¿Seguro que deseas eliminar "${a.nombre}"?`, confirm: 'Eliminar', cancel: 'Cancelar', danger: true },
    }).afterClosed().subscribe(async (ok) => {
      if (!ok) return;
      try {
        await firstValueFrom(this.api.delete<any>(`psychology/archivos/${a.id}`));
        this.toastr.success('Archivo eliminado');
        const id = this.studentId();
        if (reloadTab === 'fichas') void this.loadFichas(id);
        if (reloadTab === 'tests') void this.loadTests(id);
        if (reloadTab === 'informes') void this.loadInformes(id);
      } catch { this.toastr.error('No se pudo eliminar el archivo', 'Error'); }
    });
  }

  deleteArchivoFromCita(a: ArchivoPsicologico, citaId: string): void {
    this.dialog.open(ConfirmDialog, {
      width: '440px',
      data: { title: 'Eliminar archivo', message: `¿Seguro que deseas eliminar "${a.nombre}"?`, confirm: 'Eliminar', cancel: 'Cancelar', danger: true },
    }).afterClosed().subscribe(async (ok) => {
      if (!ok) return;
      try {
        await firstValueFrom(this.api.delete<any>(`psychology/archivos/${a.id}`));
        this.toastr.success('Archivo eliminado');
        this.reloadCitaDetail(citaId);
      } catch { this.toastr.error('No se pudo eliminar el archivo', 'Error'); }
    });
  }

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
      (informe as any).citaId
        ? this.reloadCitaDetail((informe as any).citaId)
        : void this.loadInformes(p.id);
    });
  }

  finalizeInforme(informe: InformePsicologico, citaId?: string): void {
    this.dialog.open(ConfirmDialog, {
      width: '460px',
      data: { title: 'Finalizar informe', message: 'Al finalizar no podrás editar el informe. ¿Continuar?', confirm: 'Finalizar', cancel: 'Cancelar' },
    }).afterClosed().subscribe(async (ok) => {
      if (!ok) return;
      try {
        await firstValueFrom(this.api.post<any>(`psychology/informes/${informe.id}/finalizar`, {}));
        this.toastr.success('Informe finalizado');
        citaId ? this.reloadCitaDetail(citaId) : void this.loadInformes(this.studentId());
      } catch { this.toastr.error('No se pudo finalizar el informe', 'Error'); }
    });
  }

  deleteInforme(informe: InformePsicologico, citaId?: string): void {
    this.dialog.open(ConfirmDialog, {
      width: '420px',
      data: { title: 'Eliminar informe', message: '¿Seguro que deseas eliminar este informe?', confirm: 'Eliminar', cancel: 'Cancelar', danger: true },
    }).afterClosed().subscribe(async (ok) => {
      if (!ok) return;
      try {
        await firstValueFrom(this.api.delete<any>(`psychology/informes/${informe.id}`));
        this.toastr.success('Informe eliminado');
        citaId ? this.reloadCitaDetail(citaId) : void this.loadInformes(this.studentId());
      } catch { this.toastr.error('No se pudo eliminar el informe', 'Error'); }
    });
  }

  openCreateAnotacion(citaId: string): void {
    const p = this.profile();
    if (!p) return;
    this.dialog.open(RecordFormDialog, {
      width: '560px', maxWidth: '95vw',
      data: { studentId: p.id, studentName: this.fullName(p), citaId },
    }).afterClosed().subscribe((ok) => {
      if (ok) this.reloadCitaDetail(citaId);
    });
  }

  openEditAnotacion(record: PsychologyRecord, citaId: string): void {
    const p = this.profile();
    if (!p) return;
    this.dialog.open(RecordFormDialog, {
      width: '560px', maxWidth: '95vw',
      data: { studentId: p.id, studentName: this.fullName(p), record },
    }).afterClosed().subscribe((ok) => {
      if (ok) this.reloadCitaDetail(citaId);
    });
  }

  deleteAnotacion(record: PsychologyRecord, citaId: string): void {
    this.dialog.open(ConfirmDialog, {
      width: '420px',
      data: { title: 'Eliminar anotación', message: '¿Seguro que deseas eliminar esta anotación?', confirm: 'Eliminar', cancel: 'Cancelar', danger: true },
    }).afterClosed().subscribe(async (ok) => {
      if (!ok) return;
      try {
        await firstValueFrom(this.api.delete<any>(`psychology/records/${record.id}`));
        this.toastr.success('Anotación eliminada');
        this.reloadCitaDetail(citaId);
      } catch { this.toastr.error('No se pudo eliminar la anotación', 'Error'); }
    });
  }

  async openNuevaCita(): Promise<void> {
    const p = this.profile();
    if (!p) return;
    const { AppointmentFormDialog } = await import(
      '../dialogs/appointment-form-dialog/appointment-form-dialog'
    );
    this.dialog.open(AppointmentFormDialog, {
      panelClass: 'afd-panel',
      autoFocus: 'first-tabbable',
      data: { alumnoId: p.id, alumnoNombre: this.fullName(p), alumnoFijo: true } as any,
    }).afterClosed().subscribe((ok: boolean) => {
      if (ok && this.tabVisited()[TAB_CITAS]) void this.loadCitas(this.studentId());
    });
  }

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

  private toArr<T = any>(res: any): T[] {
    const b = res?.data ?? res;
    return Array.isArray(b) ? b : (b?.data ?? []);
  }

  private reloadCitaDetail(citaId: string): void {
    const m = new Map(this.citaDetails());
    m.delete(citaId);
    this.citaDetails.set(m);
    const cita = this.citas().find(c => c.id === citaId);
    if (cita) void this.onCitaExpand(cita);
  }
}
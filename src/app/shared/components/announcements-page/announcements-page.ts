import {
  Component, inject, signal, computed, OnInit,
  ChangeDetectionStrategy, HostListener,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/auth/auth';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { StagedAttachmentsPicker } from '../staged-attachments-picker/staged-attachments-picker';
import { AttachmentsService, ATTACHMENT_MAX_BYTES } from '../../../core/services/attachments';
import { FormControl } from '@angular/forms';
import { NotificationsStore, NotificationItem } from '../../../core/services/notifications-store';
import { Router } from '@angular/router';
import {
  iconForType,
  colorForType,
  routeForReferenceType,
} from '../../utils/notifications-helpers';

interface ArchivoItem {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  url?: string;
  preview_url?: string;
}

interface CreadorInfo {
  id: string;
  nombre_completo: string;
  rol: string;
  foto_url?: string | null;
}

interface ComunicadoItem {
  id: string;
  titulo: string;
  contenido_preview: string;
  contenido_completo?: string | null;
  importante: boolean;
  fijado: boolean;
  fijado_hasta?: string | null;
  destinatarios: string[];
  activo: boolean;
  vistas: number;
  leido_por_mi?: boolean;
  anio?: number | null;
  bimestre_label?: string | null;
  created_at: string;
  updated_at: string;
  creado_por: CreadorInfo;
  archivos: ArchivoItem[];
  total_archivos: number;
  lecturas_total?: number;
}

interface ComunicadosResponse {
  data: ComunicadoItem[];
  size: number;
  has_next: boolean;
  next_cursor: string | null;
  total_fijados: number;
  total_no_leidos: number;
}

interface PeriodoItem {
  id: string;
  nombre: string;
  anio: number;
  bimestre: number;
  activo: boolean;
}

// FIX: auxiliares → staff
const LABELS: Record<string, string> = {
  todos: 'Todos',
  alumnos: 'Alumnos',
  docentes: 'Docentes',
  padres: 'Padres',
  psicologas: 'Psicólogas',
  staff: 'Personal de Apoyo',
};

@Component({
  selector: 'app-announcements-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, DatePipe,
    MatIconModule, MatButtonModule, MatDialogModule, MatTooltipModule,
    MatFormFieldModule, MatSelectModule, MatSlideToggleModule,
    MatChipsModule, MatDatepickerModule, MatProgressSpinnerModule,
    StagedAttachmentsPicker,
  ],
  templateUrl: './announcements-page.html',
  styleUrl: './announcements-page.scss',
})
export class AnnouncementsPage implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  private attachments = inject(AttachmentsService);
  private notifStore = inject(NotificationsStore);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  activeTab = signal<'comunicados' | 'notificaciones'>('comunicados');
  notifFilter = signal<'todas' | 'no_leidas'>('todas');

  notifications = this.notifStore.items;
  notifUnreadCount = this.notifStore.unreadCount;

  filteredNotifications = computed(() => {
    const list = this.notifications();
    return this.notifFilter() === 'no_leidas' ? list.filter(n => !n.read) : list;
  });

  iconFor = (tipo: string) => iconForType(tipo as any);
  colorFor = (tipo: string) => colorForType(tipo as any);

  items = signal<ComunicadoItem[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  saving = signal(false);
  checkingPermiso = signal(true);
  tienePermiso = signal(false);
  totalNoLeidos = signal(0);
  totalFijados = signal(0);
  nextCursor = signal<string | null>(null);
  hasNext = signal(false);

  periodos = signal<PeriodoItem[]>([]);

  stagedFiles = signal<File[]>([]);
  readonly maxFileBytes = ATTACHMENT_MAX_BYTES;
  readonly maxFiles = 5;

  showForm = signal(false);

  busqueda = new FormControl('');

  // FIX: el filtro guarda el periodo seleccionado completo para extraer el anio
  periodoFiltro = new FormControl<PeriodoItem | null>(null);

  soloImportantes = signal(false);
  soloNoLeidos = signal(false);

  previewList = signal<ArchivoItem[]>([]);
  previewIndex = signal(0);

  previewArchivo = computed<ArchivoItem | null>(
    () => this.previewList()[this.previewIndex()] ?? null,
  );

  previewSrc(arch: ArchivoItem): string {
    return arch.preview_url ?? arch.url ?? '';
  }

  safePreviewUrl = computed<SafeResourceUrl | null>(() => {
    const pv = this.previewArchivo();
    if (!pv || this.isImage(pv.mime_type)) return null;
    const src = this.previewSrc(pv);
    if (!src) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(src);
  });

  readonly userId = computed(() => this.auth.currentUser()?.id ?? '');
  readonly rol = computed(() => this.auth.currentUser()?.rol ?? '');

  canCreate = computed(() => {
    if (this.rol() === 'admin') return true;
    return !this.checkingPermiso() && this.tienePermiso();
  });

  canDelete = computed(() => this.rol() === 'admin');

  // FIX: auxiliares → staff
  destOptions: { value: string; label: string; icon: string }[] = [
    { value: 'todos', label: 'Todos', icon: 'groups' },
    { value: 'alumnos', label: 'Alumnos', icon: 'school' },
    { value: 'docentes', label: 'Docentes', icon: 'badge' },
    { value: 'padres', label: 'Padres', icon: 'family_restroom' },
    { value: 'psicologas', label: 'Psicólogas', icon: 'psychology' },
    { value: 'staff', label: 'Personal de Apoyo', icon: 'support_agent' },
  ];

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(200)]],
    contenido: ['', Validators.required],
    destinatarios: [['todos'] as string[], Validators.required],
    importante: [false],
  });

  selectedDests = computed<string[]>(() =>
    (this.form.get('destinatarios')?.value as string[]) ?? [],
  );

  labelDest(d: string): string {
    if (d.startsWith('grado:')) return 'Grado específico';
    if (d.startsWith('seccion:')) return 'Sección específica';
    return LABELS[d] ?? d;
  }

  isDestSelected(value: string): boolean {
    return ((this.form.get('destinatarios')?.value as string[]) ?? []).includes(value);
  }

  toggleDest(value: string): void {
    const current = [...((this.form.get('destinatarios')?.value as string[]) ?? [])];
    if (value === 'todos') {
      this.form.get('destinatarios')?.setValue(current.includes('todos') ? [] : ['todos']);
      return;
    }
    const sinTodos = current.filter(d => d !== 'todos');
    const idx = sinTodos.indexOf(value);
    if (idx >= 0) sinTodos.splice(idx, 1);
    else sinTodos.push(value);
    this.form.get('destinatarios')?.setValue(sinTodos);
  }

  ngOnInit() {
    this.verificarPermiso();
    this.cargarPeriodos();
    this.cargar();

    this.busqueda.valueChanges.pipe(
      debounceTime(400), distinctUntilChanged(),
    ).subscribe(() => this.cargar());
  }

  private verificarPermiso() {
    if (this.rol() === 'admin') {
      this.tienePermiso.set(true);
      this.checkingPermiso.set(false);
      return;
    }
    if (!this.userId()) { this.checkingPermiso.set(false); return; }
    this.api.get<{ tiene: boolean }>(`permissions/check/${this.userId()}/comunicados/crear`).subscribe({
      next: r => {
        this.tienePermiso.set((r as any).data?.tiene ?? false);
        this.checkingPermiso.set(false);
      },
      error: () => this.checkingPermiso.set(false),
    });
  }

  private cargarPeriodos() {
    this.api.get<PeriodoItem[]>('academic/periodos').subscribe({
      next: r => {
        const todos: PeriodoItem[] = (r as any).data ?? [];
        const activo = todos.find(p => p.activo);
        const anioActual = activo?.anio ?? new Date().getFullYear();
        this.periodos.set(todos.filter(p => p.anio === anioActual));
      },
      error: () => { },
    });
  }

  private cargar(append = false) {
    if (append) this.loadingMore.set(true);
    else this.loading.set(true);

    const params: Record<string, string> = {};
    if (append && this.nextCursor()) params['cursor'] = this.nextCursor()!;

    // FIX: extraer anio del periodo seleccionado en lugar de enviar periodo_id
    const periodoSel = this.periodoFiltro.value;
    if (periodoSel) params['anio'] = String(periodoSel.anio);

    if (this.soloImportantes()) params['importante'] = 'true';
    if (this.soloNoLeidos()) params['no_leidos'] = 'true';
    if (this.busqueda.value?.trim()) params['buscar'] = this.busqueda.value!.trim();

    this.api.get<ComunicadosResponse>('comunicados', params).subscribe({
      next: r => {
        const body = (r as any).data ?? r;
        const nuevos: ComunicadoItem[] = body?.data ?? [];
        if (append) this.items.update(list => [...list, ...nuevos]);
        else this.items.set(nuevos);
        this.hasNext.set(body?.has_next ?? false);
        this.nextCursor.set(body?.next_cursor ?? null);
        this.totalFijados.set(body?.total_fijados ?? 0);
        this.totalNoLeidos.set(body?.total_no_leidos ?? 0);
        this.loading.set(false);
        this.loadingMore.set(false);
      },
      error: () => {
        if (!append) this.items.set([]);
        this.loading.set(false);
        this.loadingMore.set(false);
      },
    });
  }

  cargarMas() {
    if (this.loadingMore() || !this.hasNext()) return;
    this.cargar(true);
  }

  toggleImportantes() { this.soloImportantes.update(v => !v); this.cargar(); }
  toggleNoLeidos() { this.soloNoLeidos.update(v => !v); this.cargar(); }
  onPeriodoChange() { this.cargar(); }

  publicar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const dests = this.form.get('destinatarios')?.value as string[];
    if (!dests?.length) { this.toastr.error('Selecciona al menos un destinatario', 'Error'); return; }
    this.saving.set(true);

    this.api.post<ComunicadoItem>('comunicados', this.form.value).subscribe({
      next: r => {
        const newId = (r as any).data?.id;
        const files = this.stagedFiles();
        if (newId && files.length > 0) {
          forkJoin(
            files.map(f =>
              this.attachments.upload(f, 'announcement', newId).pipe(catchError(() => of(null))),
            ),
          ).subscribe({
            next: results => {
              const failures = results.filter(x => x === null).length;
              if (failures > 0) this.toastr.error(`No se pudieron subir ${failures} archivo(s)`);
              else this.toastr.success('Comunicado publicado', 'Éxito');
              this.finishPublicar();
            },
          });
        } else {
          this.toastr.success('Comunicado publicado', 'Éxito');
          this.finishPublicar();
        }
      },
      error: err => {
        this.toastr.error(err?.error?.message ?? 'No se pudo publicar', 'Error');
        this.saving.set(false);
      },
    });
  }

  private finishPublicar(): void {
    this.form.reset({ titulo: '', contenido: '', destinatarios: ['todos'], importante: false });
    this.stagedFiles.set([]);
    this.showForm.set(false);
    this.saving.set(false);
    this.cargar();
  }

  archivar(a: ComunicadoItem) {
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Archivar comunicado',
        message: `¿Archivar "${a.titulo}"?`,
        confirm: 'Archivar',
        cancel: 'Cancelar',
        danger: true,
      },
    });
    ref.afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.patch(`comunicados/${a.id}/archivar`, {}).subscribe({
        next: () => { this.toastr.success('Archivado', 'Éxito'); this.cargar(); },
        error: () => this.toastr.error('Error al archivar', 'Error'),
      });
    });
  }

  isImage(mime: string): boolean { return !!mime && mime.startsWith('image/'); }
  isPdf(mime: string): boolean { return mime === 'application/pdf'; }
  isPreviewable(mime: string): boolean { return this.isImage(mime) || this.isPdf(mime); }

  imagenesDe(a: ComunicadoItem): ArchivoItem[] {
    return a.archivos.filter(x => this.isImage(x.mime_type) && (!!x.preview_url || !!x.url));
  }

  documentosDe(a: ComunicadoItem): ArchivoItem[] {
    return a.archivos.filter(x => !this.isImage(x.mime_type));
  }

  getUrgenciaIcon(mime: string): string {
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf') return 'picture_as_pdf';
    if (mime.startsWith('video/')) return 'movie';
    if (mime.startsWith('audio/')) return 'audio_file';
    if (mime.includes('word')) return 'description';
    if (mime.includes('sheet') || mime.includes('excel')) return 'table_chart';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return 'slideshow';
    return 'insert_drive_file';
  }

  tipoLabel(mime: string): string {
    if (this.isImage(mime)) return 'Imagen';
    if (this.isPdf(mime)) return 'PDF';
    if (mime.startsWith('video/')) return 'Video';
    if (mime.startsWith('audio/')) return 'Audio';
    if (mime.includes('word')) return 'Documento';
    if (mime.includes('sheet') || mime.includes('excel')) return 'Hoja de cálculo';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return 'Presentación';
    return 'Archivo';
  }

  openPreview(a: ComunicadoItem, arch: ArchivoItem): void {
    const src = arch.preview_url ?? arch.url;
    if (!src) return;
    if (!this.isPreviewable(arch.mime_type)) {
      window.open(src, '_blank', 'noopener');
      return;
    }
    const previewables = a.archivos.filter(
      x => this.isPreviewable(x.mime_type) && (!!x.preview_url || !!x.url),
    );
    const idx = previewables.findIndex(x => x.id === arch.id);
    this.previewList.set(previewables);
    this.previewIndex.set(idx < 0 ? 0 : idx);
  }

  closePreview(): void { this.previewList.set([]); this.previewIndex.set(0); }

  nextPreview(): void {
    const n = this.previewList().length;
    if (n < 2) return;
    this.previewIndex.update(i => (i + 1) % n);
  }

  prevPreview(): void {
    const n = this.previewList().length;
    if (n < 2) return;
    this.previewIndex.update(i => (i - 1 + n) % n);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (!this.previewArchivo()) return;
    if (ev.key === 'Escape') this.closePreview();
    else if (ev.key === 'ArrowRight') this.nextPreview();
    else if (ev.key === 'ArrowLeft') this.prevPreview();
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  onNotifClick(n: NotificationItem) {
    if (!n.read) this.notifStore.markOneAsRead(n.id);
    const route = routeForReferenceType(n.referenceType);
    if (route) this.router.navigate([route]);
  }

  markNotifAsRead(id: string, ev: Event) {
    ev.stopPropagation();
    this.notifStore.markOneAsRead(id);
  }

  markAllNotifAsRead() { this.notifStore.markAllAsRead(); }

  toggleNotifFilter(filter: 'todas' | 'no_leidas') { this.notifFilter.set(filter); }

  switchTab(tab: 'comunicados' | 'notificaciones') {
    this.activeTab.set(tab);
    if (tab === 'notificaciones') this.notifStore.refresh();
  }
}
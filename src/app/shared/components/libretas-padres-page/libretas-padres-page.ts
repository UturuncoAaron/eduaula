import {
  ChangeDetectionStrategy, Component, computed,
  inject, OnInit, signal, viewChild,
} from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ToastService } from 'ngx-toastr-notifier';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';

import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/auth/auth';
import {
  NotebookUploadDrawer,
  type NotebookUploadTarget,
} from '../notebook-upload-drawer/notebook-upload-drawer';
import { LibretaAuditoriaDialog } from '../libreta-auditoria-dialog/libreta-auditoria-dialog';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface SeccionItem { id: string; nombre: string; grado_nombre: string; }

interface PeriodoItem { id: number; nombre: string; bimestre: number; anio: number; activo: boolean; }

export interface LecturaInfo { vista_en: string; ultima_apertura_en: string; veces_vista: number; }

export interface LibretaConLectura {
  id: string; url: string; nombre_archivo: string | null; lectura: LecturaInfo | null;
}

export interface HijoConLibreta {
  alumno_id: string; nombre: string; apellido_paterno: string;
  apellido_materno: string | null; grado: string | null; seccion: string | null;
  libreta: LibretaConLectura | null;
}

export interface PadreLibretaItem {
  id: string; nombre: string; apellido_paterno: string;
  apellido_materno: string | null; relacion: string;
  libreta: LibretaConLectura | null;
  hijos: HijoConLibreta[];
  resumen_lectura: {
    propia_cargada: boolean; propia_leida: boolean;
    hijos_total: number; hijos_cargados: number; hijos_leidos: number;
  };
}

export interface BulkUploadPadresData {
  padres: PadreLibretaItem[];
  periodo_id: number;
  periodo_label: string;
  existentes: Set<string>;
}

// ── Componente ──────────────────────────────────────────────────────────────

@Component({
  selector: 'app-libretas-padres-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, TitleCasePipe, FormsModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatProgressBarModule, MatProgressSpinnerModule,
    MatSelectModule, MatFormFieldModule, MatInputModule, MatTooltipModule,
    MatSidenavModule, MatPaginatorModule, MatDialogModule, MatBadgeModule,
    NotebookUploadDrawer,
  ],
  templateUrl: './libretas-padres-page.html',
  styleUrl: './libretas-padres-page.scss',
})
export class LibretasPadresPage implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toastr = inject(ToastService);
  private dialog = inject(MatDialog);

  readonly drawerRef = viewChild<MatSidenav>('drawer');
  readonly uploadTarget = signal<NotebookUploadTarget | null>(null);
  readonly expandedId = signal<string | null>(null);

  readonly loadingSecciones = signal(true);
  readonly loadingPadres = signal(false);
  readonly secciones = signal<SeccionItem[]>([]);
  readonly periodos = signal<PeriodoItem[]>([]);
  readonly padres = signal<PadreLibretaItem[]>([]);
  readonly total = signal(0);

  readonly seccionId = signal<string | null>(null);
  readonly periodoId = signal<number | null>(null);
  readonly isAdmin = signal(false);
  readonly busqueda = new FormControl('');
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly statsGlobal = signal({ cargadas: 0, totalStats: 0 });

  readonly progresoPct = computed(() => {
    const { cargadas, totalStats } = this.statsGlobal();
    return totalStats === 0 ? 0 : Math.round((cargadas / totalStats) * 100);
  });

  readonly pendientes = computed(() => {
    const { cargadas, totalStats } = this.statsGlobal();
    return Math.max(0, totalStats - cargadas);
  });

  readonly periodoSeleccionado = computed(() =>
    this.periodos().find(p => p.id === this.periodoId()) ?? null,
  );

  ngOnInit(): void {
    this.isAdmin.set(this.auth.isAdmin());
    this.cargarDatosIniciales();

    this.busqueda.valueChanges.pipe(
      debounceTime(350), distinctUntilChanged(),
    ).subscribe(() => {
      if (!this.isAdmin()) return;
      this.page.set(1);
      this.cargarPadres();
    });
  }

  private cargarDatosIniciales(): void {
    const seccionesEp = this.isAdmin() ? 'academic/secciones' : 'academic/mis-secciones';

    Promise.all([
      this.api.get<any[]>(seccionesEp).toPromise(),
      this.api.get<PeriodoItem[]>('academic/periodos').toPromise(),
    ]).then(([secRes, perRes]) => {
      const rawSecs = (secRes as any)?.data ?? secRes ?? [];
      const pers = ((perRes as any)?.data ?? perRes ?? []) as PeriodoItem[];

      this.secciones.set(rawSecs.map((s: any) => ({
        id: s.id, nombre: s.nombre,
        grado_nombre: s.grado?.nombre ?? s.grado_nombre ?? '',
      })));
      this.periodos.set(pers);

      const activo = pers.find((p: PeriodoItem) => p.activo);
      if (activo) this.periodoId.set(activo.id);
      if (this.periodoId()) this.cargarPadres();

      this.loadingSecciones.set(false);
    }).catch(() => {
      this.loadingSecciones.set(false);
      this.toastr.error('No se pudieron cargar los datos iniciales', 'Error');
    });
  }

  onSeccionChange(id: string | null): void {
    this.seccionId.set(id); this.page.set(1);
    if (this.periodoId()) this.cargarPadres();
  }

  onPeriodoChange(id: number): void {
    this.periodoId.set(id); this.page.set(1);
    this.cargarPadres();
  }

  onPageChange(e: PageEvent): void {
    this.page.set(e.pageIndex + 1); this.pageSize.set(e.pageSize);
    this.cargarPadres();
  }

  limpiarBusqueda(): void { this.busqueda.setValue(''); }

  toggleExpand(id: string): void {
    this.expandedId.update(cur => cur === id ? null : id);
  }

  // Usa el mismo endpoint para admin y docente.
  // El backend ya permite docentes (@Roles('admin','docente')) y
  // devuelve TODOS los padres — el filtro de sección es opcional.
  private cargarPadres(): void {
    const pid = this.periodoId();
    if (!pid) return;

    this.loadingPadres.set(true);

    const params = new URLSearchParams({
      periodo_id: String(pid),
      page: String(this.page()),
      limit: String(this.pageSize()),
    });

    const sid = this.seccionId();
    if (sid) params.set('seccion_id', sid);

    if (this.isAdmin()) {
      const q = this.busqueda.value?.trim();
      if (q) params.set('search', q);
    }

    this.api.get<any>(`libretas/padre/admin/listado?${params}`).subscribe({
      next: (r: any) => {
        const body = r?.data ?? r ?? {};
        const items = (body.items ?? []) as PadreLibretaItem[];
        this.padres.set(items);
        this.total.set(body.total ?? 0);
        this.statsGlobal.set(body.stats
          ? { cargadas: body.stats.cargadas ?? 0, totalStats: body.stats.total ?? body.total ?? 0 }
          : { cargadas: items.filter(p => p.libreta !== null).length, totalStats: body.total ?? items.length }
        );
        this.loadingPadres.set(false);
      },
      error: () => {
        this.loadingPadres.set(false);
        this.toastr.error('No se pudieron cargar los padres', 'Error');
      },
    });
  }

  openUpload(p: PadreLibretaItem): void {
    const periodo = this.periodoSeleccionado();
    if (!periodo) return;
    this.uploadTarget.set({
      cuenta_id: p.id,
      cuenta_label: this.padreNombre(p),
      periodo_id: periodo.id,
      periodo_label: `Bim ${periodo.bimestre} · ${periodo.anio}`,
      tipo: 'padre',
      libreta_existente: p.libreta ? { nombre_archivo: p.libreta.nombre_archivo } : null,
    });
    this.drawerRef()?.open();
  }

  closeDrawer(): void { this.drawerRef()?.close(); this.uploadTarget.set(null); }

  onUploaded(): void { this.closeDrawer(); this.cargarPadres(); }

  async openBulkUpload(): Promise<void> {
    const periodo = this.periodoSeleccionado();
    if (!periodo) { this.toastr.warning('Selecciona un bimestre primero', 'Aviso'); return; }

    const { BulkUploadPadres } = await import('../bulk-upload-padres/bulk-upload-padres');

    const ref = this.dialog.open(BulkUploadPadres, {
      data: {
        padres: this.padres(),
        periodo_id: periodo.id,
        periodo_label: `Bim ${periodo.bimestre} · ${periodo.anio}`,
        existentes: new Set(this.padres().filter(p => p.libreta !== null).map(p => p.id)),
      } satisfies BulkUploadPadresData,
      maxWidth: '860px', width: '92vw', maxHeight: '90vh',
      panelClass: 'bulk-upload-dialog-panel', autoFocus: false,
    });

    ref.afterClosed().subscribe((r?: { uploaded?: number }) => {
      if ((r?.uploaded ?? 0) > 0) this.cargarPadres();
    });
  }

  verAuditoria(libretaId: string, label: string): void {
    this.dialog.open(LibretaAuditoriaDialog, {
      data: { libretaId, label }, width: '520px', maxWidth: '94vw', autoFocus: false,
    });
  }

  initials(p: PadreLibretaItem): string {
    return `${p.nombre[0] ?? ''}${p.apellido_paterno[0] ?? ''}`.toUpperCase();
  }

  padreNombre(p: PadreLibretaItem): string {
    return `${p.nombre} ${p.apellido_paterno}${p.apellido_materno ? ' ' + p.apellido_materno : ''}`;
  }

  hijoNombre(h: HijoConLibreta): string {
    return `${h.nombre} ${h.apellido_paterno}${h.apellido_materno ? ' ' + h.apellido_materno : ''}`;
  }

  trackById = (_: number, p: PadreLibretaItem): string => p.id;
  trackHijo = (_: number, h: HijoConLibreta): string => h.alumno_id;
}
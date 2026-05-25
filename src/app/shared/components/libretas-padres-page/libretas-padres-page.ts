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

interface SeccionItem {
  id: string;
  nombre: string;
  grado_nombre: string;
}

interface PeriodoItem {
  id: number;
  nombre: string;
  bimestre: number;
  anio: number;
  activo: boolean;
}

export interface LecturaInfo {
  vista_en: string;
  ultima_apertura_en: string;
  veces_vista: number;
}

export interface LibretaConLectura {
  id: string;
  url: string;
  nombre_archivo: string | null;
  lectura: LecturaInfo | null;
}

export interface HijoConLibreta {
  alumno_id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  grado: string | null;
  seccion: string | null;
  libreta: LibretaConLectura | null;
}

interface PadreLibretaItem {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  relacion: string;
  libreta: LibretaConLectura | null;
  hijos: HijoConLibreta[];
  resumen_lectura: {
    propia_cargada: boolean;
    propia_leida: boolean;
    hijos_total: number;
    hijos_cargados: number;
    hijos_leidos: number;
  };
}

@Component({
  selector: 'app-libretas-padres-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, TitleCasePipe, FormsModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatProgressBarModule,
    MatProgressSpinnerModule, MatSelectModule, MatFormFieldModule,
    MatInputModule, MatTooltipModule, MatSidenavModule, MatPaginatorModule,
    MatDialogModule, MatBadgeModule,
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

  readonly loadingSecciones = signal(true);
  readonly loadingPadres = signal(false);
  readonly secciones = signal<SeccionItem[]>([]);
  readonly periodos = signal<PeriodoItem[]>([]);
  readonly padres = signal<PadreLibretaItem[]>([]);
  readonly seccionId = signal<string | null>(null);
  readonly periodoId = signal<number | null>(null);

  /** Vista admin: lista paginada de TODOS los padres del periodo. */
  readonly isAdmin = signal(false);
  readonly busqueda = new FormControl('');
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly total = signal(0);

  readonly progreso = computed(() => {
    const lista = this.padres();
    const cargadas = lista.filter(p => p.libreta !== null).length;
    return { cargadas, total: lista.length };
  });

  readonly progresoPct = computed(() => {
    const { cargadas, total } = this.progreso();
    return total === 0 ? 0 : Math.round((cargadas / total) * 100);
  });

  readonly pendientes = computed(() =>
    Math.max(0, this.progreso().total - this.progreso().cargadas),
  );

  readonly seccionSeleccionada = computed(() =>
    this.secciones().find(s => s.id === this.seccionId()) ?? null,
  );

  readonly periodoSeleccionado = computed(() =>
    this.periodos().find(p => p.id === this.periodoId()) ?? null,
  );

  ngOnInit(): void {
    this.isAdmin.set(this.auth.isAdmin());
    this.cargarDatosIniciales();

    // Búsqueda con debounce (sólo admin)
    this.busqueda.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged(),
    ).subscribe(() => {
      if (!this.isAdmin()) return;
      this.page.set(1);
      this.cargarPadres();
    });
  }

  private cargarDatosIniciales(): void {
    const isAdmin = this.isAdmin();

    // Admin → todas las secciones  |  Docente → solo sus secciones
    const seccionesEndpoint = isAdmin
      ? 'academic/secciones'
      : 'academic/mis-secciones';

    Promise.all([
      this.api.get<any[]>(seccionesEndpoint).toPromise(),
      this.api.get<PeriodoItem[]>('academic/periodos').toPromise(),
    ]).then(([secRes, perRes]) => {
      const rawSecs = (secRes as any)?.data ?? secRes ?? [];
      const pers = (perRes as any)?.data ?? perRes ?? [];

      // academic/secciones devuelve entidades con relación grado: { nombre }
      // academic/mis-secciones devuelve filas raw con grado_nombre plano
      const secs: SeccionItem[] = rawSecs.map((s: any) => ({
        id: s.id,
        nombre: s.nombre,
        grado_nombre: s.grado?.nombre ?? s.grado_nombre ?? '',
      }));

      this.secciones.set(secs);
      this.periodos.set(pers);

      // Auto-seleccionar periodo activo
      const activo = pers.find((p: PeriodoItem) => p.activo);
      if (activo) this.periodoId.set(activo.id);

      // Admin → cargar TODOS los padres del periodo activo (paginado, sin filtros)
      if (isAdmin && this.periodoId()) {
        this.cargarPadres();
      }

      // Docente con una sola sección → auto-seleccionar
      if (!isAdmin && secs.length === 1) {
        this.seccionId.set(secs[0].id);
        this.cargarPadres();
      }

      this.loadingSecciones.set(false);
    }).catch(() => {
      this.loadingSecciones.set(false);
      this.toastr.error('No se pudieron cargar los datos iniciales', 'Error');
    });
  }

  onSeccionChange(id: string | null): void {
    this.seccionId.set(id);
    this.padres.set([]);
    this.page.set(1);
    if (this.isAdmin()) {
      if (this.periodoId()) this.cargarPadres();
    } else {
      if (id && this.periodoId()) this.cargarPadres();
    }
  }

  onPeriodoChange(id: number): void {
    this.periodoId.set(id);
    this.padres.set([]);
    this.page.set(1);
    if (this.isAdmin()) {
      if (id) this.cargarPadres();
    } else {
      if (this.seccionId() && id) this.cargarPadres();
    }
  }

  onPageChange(e: PageEvent): void {
    this.page.set(e.pageIndex + 1);
    this.pageSize.set(e.pageSize);
    this.cargarPadres();
  }

  limpiarBusqueda(): void {
    this.busqueda.setValue('');
  }

  private cargarPadres(): void {
    const pid = this.periodoId();
    if (!pid) return;

    // Admin → endpoint paginado, sin requerir sección
    if (this.isAdmin()) {
      this.loadingPadres.set(true);
      const params = new URLSearchParams();
      params.set('periodo_id', String(pid));
      params.set('page', String(this.page()));
      params.set('limit', String(this.pageSize()));
      const sid = this.seccionId();
      if (sid) params.set('seccion_id', sid);
      const q = this.busqueda.value?.trim();
      if (q) params.set('search', q);

      this.api.get<any>(`libretas/padre/admin/listado?${params.toString()}`).subscribe({
        next: (r: any) => {
          const body = r?.data ?? r ?? {};
          this.padres.set(body.items ?? []);
          this.total.set(body.total ?? 0);
          this.loadingPadres.set(false);
        },
        error: () => {
          this.loadingPadres.set(false);
          this.toastr.error('No se pudieron cargar los padres', 'Error');
        },
      });
      return;
    }

    // Docente → endpoint legacy, requiere sección
    const sid = this.seccionId();
    if (!sid) return;
    this.loadingPadres.set(true);
    this.api
      .get<PadreLibretaItem[]>(`libretas/padre/seccion/${sid}?periodo_id=${pid}`)
      .subscribe({
        next: (r: any) => {
          const list = r?.data ?? [];
          this.padres.set(list);
          this.total.set(list.length);
          this.loadingPadres.set(false);
        },
        error: () => {
          this.loadingPadres.set(false);
          this.toastr.error('No se pudieron cargar los padres', 'Error');
        },
      });
  }

  initials(p: PadreLibretaItem): string {
    return `${p.nombre[0] ?? ''}${p.apellido_paterno[0] ?? ''}`.toUpperCase();
  }

  openUpload(p: PadreLibretaItem): void {
    const periodo = this.periodoSeleccionado();
    if (!periodo) return;

    this.uploadTarget.set({
      cuenta_id: p.id,
      cuenta_label: `${p.nombre} ${p.apellido_paterno}${p.apellido_materno ? ' ' + p.apellido_materno : ''}`,
      periodo_id: periodo.id,
      periodo_label: `Bim ${periodo.bimestre} · ${periodo.anio}`,
      tipo: 'padre',
      libreta_existente: p.libreta
        ? { nombre_archivo: p.libreta.nombre_archivo }
        : null,
    });
    this.drawerRef()?.open();
  }

  closeDrawer(): void {
    this.drawerRef()?.close();
    this.uploadTarget.set(null);
  }

  onUploaded(): void {
    this.closeDrawer();
    this.cargarPadres();
  }

  trackById = (_: number, p: PadreLibretaItem): string => p.id;

  trackHijo = (_: number, h: HijoConLibreta): string => h.alumno_id;

  // ── Auditoría ─────────────────────────────────────────────────────────
  /** Abre el dialog con el historial de lecturas de una libreta. */
  verAuditoria(libretaId: string, label: string): void {
    this.dialog.open(LibretaAuditoriaDialog, {
      data: { libretaId, label },
      width: '520px',
      maxWidth: '94vw',
      autoFocus: false,
    });
  }

  hijoNombre(h: HijoConLibreta): string {
    const mat = h.apellido_materno ? ` ${h.apellido_materno}` : '';
    return `${h.nombre} ${h.apellido_paterno}${mat}`;
  }

  padreNombre(p: PadreLibretaItem): string {
    const mat = p.apellido_materno ? ` ${p.apellido_materno}` : '';
    return `${p.nombre} ${p.apellido_paterno}${mat}`;
  }
}
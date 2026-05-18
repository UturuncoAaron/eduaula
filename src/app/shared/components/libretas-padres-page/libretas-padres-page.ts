import {
  ChangeDetectionStrategy, Component, computed,
  inject, OnInit, signal, viewChild,
} from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { FormsModule } from '@angular/forms';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/auth/auth';
import {
  NotebookUploadDrawer,
  type NotebookUploadTarget,
} from '../notebook-upload-drawer/notebook-upload-drawer';

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

interface PadreLibretaItem {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  relacion: string;
  libreta: {
    id: string;
    url: string;
    nombre_archivo: string | null;
  } | null;
}

@Component({
  selector: 'app-libretas-padres-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleCasePipe, FormsModule,
    MatButtonModule, MatIconModule, MatProgressBarModule,
    MatProgressSpinnerModule, MatSelectModule, MatFormFieldModule,
    MatTooltipModule, MatSidenavModule,
    NotebookUploadDrawer,
  ],
  templateUrl: './libretas-padres-page.html',
  styleUrl: './libretas-padres-page.scss',
})
export class LibretasPadresPage implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toastr = inject(ToastService);

  readonly drawerRef = viewChild<MatSidenav>('drawer');
  readonly uploadTarget = signal<NotebookUploadTarget | null>(null);

  readonly loadingSecciones = signal(true);
  readonly loadingPadres = signal(false);
  readonly secciones = signal<SeccionItem[]>([]);
  readonly periodos = signal<PeriodoItem[]>([]);
  readonly padres = signal<PadreLibretaItem[]>([]);
  readonly seccionId = signal<string | null>(null);
  readonly periodoId = signal<number | null>(null);

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
    this.cargarDatosIniciales();
  }

  private cargarDatosIniciales(): void {
    const isAdmin = this.auth.isAdmin();

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

  onSeccionChange(id: string): void {
    this.seccionId.set(id);
    this.padres.set([]);
    if (id && this.periodoId()) this.cargarPadres();
  }

  onPeriodoChange(id: number): void {
    this.periodoId.set(id);
    this.padres.set([]);
    if (this.seccionId() && id) this.cargarPadres();
  }

  private cargarPadres(): void {
    const sid = this.seccionId();
    const pid = this.periodoId();
    if (!sid || !pid) return;

    this.loadingPadres.set(true);
    this.api
      .get<PadreLibretaItem[]>(`libretas/padre/seccion/${sid}?periodo_id=${pid}`)
      .subscribe({
        next: (r: any) => {
          this.padres.set(r?.data ?? []);
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
}
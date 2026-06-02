import {
  Component, ChangeDetectionStrategy, inject,
  signal, computed, OnInit, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import { AsistenciaDocentesService } from '../../../core/services/asistencia-docentes';
import { PeriodoService } from '../../../core/services/periodo';
import type { Period } from '../../../core/models/academic';
import type {
  DocenteDelDia,
  EstadoDocenteAsistencia as EstadoDocente,
  ReporteDocenteFilters as ReporteFilters,
  ReporteDocenteRow,
  ResumenDocenteRow,
} from '../../../core/models/asistencia-docentes';

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface EstadoEdicion {
  estado: EstadoDocente;
  hora_llegada?: string;
  motivo_justificacion?: string;
  hubo_reemplazo?: boolean;
}

type TabActivo = 'registro' | 'reportes';
type TipoFiltro = 'dia' | 'rango' | 'bimestre' | 'anio';

// ── Constantes ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

@Component({
  selector: 'app-asistencia-docentes',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asistencia-docentes.html',
  styleUrl: './asistencia-docentes.scss',
})
export class AsistenciaDocentes implements OnInit, OnDestroy {
  private readonly svc = inject(AsistenciaDocentesService);
  private readonly periodoSvc = inject(PeriodoService);
  private readonly toastr = inject(ToastService);
  private readonly router = inject(Router);

  // ── Estado general ─────────────────────────────────────────────────────────

  // SOLUCIÓN AL DESFASE: Formatea la fecha actual forzando la zona horaria de Perú de manera nativa (Formato YYYY-MM-DD)
  readonly todayStr = (() => {
    const opciones = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
    const formateador = new Intl.DateTimeFormat('en-CA', opciones); // 'en-CA' genera la estructura YYYY-MM-DD de forma limpia
    return formateador.format(new Date());
  })();

  readonly tabActivo = signal<TabActivo>('registro');

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 1 — REGISTRO
  // ══════════════════════════════════════════════════════════════════════════

  readonly fecha = signal<string>(this.todayStr);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly docentes = signal<DocenteDelDia[]>([]);
  readonly edicion = signal<Map<string, EstadoEdicion>>(new Map());
  readonly expandido = signal<string | null>(null);
  readonly salidaMarcando = signal<string | null>(null);

  readonly horaActual = signal<Date>(new Date());
  private clockInterval?: ReturnType<typeof setInterval>;

  // ── Computed registro ──────────────────────────────────────────────────────

  readonly fechaLabel = computed(() => {
    const d = new Date(this.fecha() + 'T00:00:00');
    return `${DIAS[d.getDay()]} , ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  });

  readonly fechaCorta = computed(() => {
    const [y, m, d] = this.fecha().split('-');
    return `${d}/${m}/${y}`;
  });

  readonly isToday = computed(() => this.fecha() === this.todayStr);
  readonly isPasado = computed(() => this.fecha() < this.todayStr);
  readonly soloLectura = computed(() => this.isPasado());

  readonly totalPresentes = computed(() => [...this.edicion().values()].filter(e => e.estado === 'presente').length);
  readonly totalTardanzas = computed(() => [...this.edicion().values()].filter(e => e.estado === 'tardanza').length);
  readonly totalFaltos = computed(() => [...this.edicion().values()].filter(e => e.estado === 'falto').length);
  readonly totalJustificados = computed(() => [...this.edicion().values()].filter(e => e.estado === 'justificado').length);

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 2 — REPORTES
  // ══════════════════════════════════════════════════════════════════════════

  readonly tipoFiltro = signal<TipoFiltro>('dia');
  readonly filtroFecha = signal<string>(this.todayStr);
  readonly filtroDesde = signal<string>(this.todayStr);
  readonly filtroHasta = signal<string>(this.todayStr);
  readonly filtroAnioStr = signal<string>(new Date().getFullYear().toString());
  readonly loadingReporte = signal(false);
  readonly descargando = signal(false);
  readonly reporteDetalle = signal<ReporteDocenteRow[]>([]);
  readonly reporteResumen = signal<ResumenDocenteRow[]>([]);
  readonly filtroEstado = signal<string>('todos');
  readonly filtroBimestre = signal<Period | null>(null);
  readonly aniosDisponibles = signal<number[]>([]);

  readonly bimestres = computed<Period[]>(() => this.periodoSvc.delAnio());

  readonly reporteDetalleFiltrado = computed(() => {
    const estado = this.filtroEstado();
    const rows = this.reporteDetalle();
    return estado === 'todos' ? rows : rows.filter(r => r.estado === estado);
  });

  readonly rangoActual = computed(() => this.svc.resolverRango(this.buildFilters()));

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit() {
    this.cargarDocentes();
    this.periodoSvc.loadAll();
    this.cargarAniosLectivos();
    this.clockInterval = setInterval(() => this.horaActual.set(new Date()), 60_000);
  }

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 1 — MÉTODOS
  // ══════════════════════════════════════════════════════════════════════════

  cargarDocentes() {
    this.loading.set(true);
    this.expandido.set(null);
    this.svc.getDocentesDelDia(this.fecha()).subscribe({
      next: data => {
        this.docentes.set(data);
        const m = new Map<string, EstadoEdicion>();
        for (const d of data) {
          m.set(d.docente_id, {
            estado: (d.estado_actual as EstadoDocente) ?? 'presente',
            hora_llegada: d.hora_llegada ?? undefined,
            motivo_justificacion: d.motivo ?? undefined,
          });
        }
        this.edicion.set(m);
        this.loading.set(false);
      },
      error: (_err: unknown) => {
        this.docentes.set([]);
        this.edicion.set(new Map());
        this.loading.set(false);
        this.toastr.error('No se pudo cargar la lista de docentes');
      },
    });
  }

  onFechaChange(value: string) {
    if (!value || value > this.todayStr) {
      this.toastr.warning('No puedes registrar asistencia de fechas futuras');
      return;
    }
    this.fecha.set(value);
    this.cargarDocentes();
  }

  tardanzaBloqueada(d: DocenteDelDia): boolean {
    if (!this.isToday()) return false;
    const [h, m] = d.primera_clase.split(':').map(Number);
    const limite = new Date();
    limite.setHours(h, m, 0, 0);
    return this.horaActual() < limite;
  }

  getEdicion(docenteId: string): EstadoEdicion {
    return this.edicion().get(docenteId) ?? { estado: 'presente' };
  }

  setEstado(d: DocenteDelDia, estado: EstadoDocente) {
    if (this.soloLectura()) return;
    if (estado === 'tardanza' && this.tardanzaBloqueada(d)) return;
    const m = new Map(this.edicion());
    const prev = m.get(d.docente_id) ?? { estado: 'presente' as EstadoDocente };

    const horaAhora = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });

    m.set(d.docente_id, {
      ...prev,
      estado,
      hora_llegada: (estado === 'presente' || estado === 'tardanza')
        ? horaAhora
        : undefined,
      motivo_justificacion: estado === 'justificado' ? prev.motivo_justificacion : undefined,
    });
    this.edicion.set(m);
  }

  setHoraLlegada(docenteId: string, valor: string) {
    this.patchEdicion(docenteId, { hora_llegada: valor || undefined });
  }

  setMotivo(docenteId: string, valor: string) {
    this.patchEdicion(docenteId, { motivo_justificacion: valor || undefined });
  }

  setReemplazo(docenteId: string, valor: boolean) {
    this.patchEdicion(docenteId, { hubo_reemplazo: valor });
  }

  marcarTodos(estado: EstadoDocente) {
    if (this.soloLectura()) return;
    const horaAhora = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
    const m = new Map<string, EstadoEdicion>();
    for (const d of this.docentes()) {
      const bloqueado = estado === 'tardanza' && this.tardanzaBloqueada(d);
      const estadoFinal = bloqueado ? 'presente' : estado;
      m.set(d.docente_id, {
        estado: estadoFinal,
        hora_llegada: (estadoFinal === 'presente' || estadoFinal === 'tardanza')
          ? horaAhora
          : undefined,
      });
    }
    this.edicion.set(m);
  }

  toggleExpandir(docenteId: string) {
    this.expandido.set(this.expandido() === docenteId ? null : docenteId);
  }

  marcarSalida(horarioId: string) {
    if (this.salidaMarcando()) return;
    const horaSalida = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
    this.salidaMarcando.set(horarioId);

    this.svc.marcarSalida({ horario_id: horarioId, fecha: this.fecha(), hora_salida: horaSalida }).subscribe({
      next: () => {
        this.salidaMarcando.set(null);
        this.toastr.success(`Salida registrada: ${horaSalida.slice(0, 5)}`);
        this.cargarDocentes();
      },
      error: (err: unknown) => {
        this.salidaMarcando.set(null);
        const e = err as { error?: { message?: string } };
        this.toastr.error(e?.error?.message ?? 'No se pudo registrar la salida');
      },
    });
  }

  guardar() {
    if (this.saving() || this.soloLectura() || !this.docentes().length) return;
    const err = this.validarRegistro();
    if (err) { this.toastr.warning(err); return; }

    this.saving.set(true);

    const registros = this.docentes().map(d => {
      const ed = this.edicion().get(d.docente_id) ?? { estado: 'presente' as EstadoDocente };
      return {
        docente_id: d.docente_id,
        estado: ed.estado,
        ...((ed.estado === 'presente' || ed.estado === 'tardanza') && ed.hora_llegada
          ? { hora_llegada: ed.hora_llegada }
          : {}),
        ...(ed.estado === 'justificado' && ed.motivo_justificacion
          ? { motivo_justificacion: ed.motivo_justificacion }
          : {}),
        ...(ed.hubo_reemplazo != null ? { hubo_reemplazo: ed.hubo_reemplazo } : {}),
      };
    });

    this.svc.registrarBulk(this.fecha(), registros).subscribe({
      next: () => {
        this.saving.set(false);
        this.toastr.success(`Asistencia guardada — ${registros.length} docentes registrados`);
        this.cargarDocentes();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const e = err as { error?: { message?: string | string[] } };
        const msg = Array.isArray(e?.error?.message)
          ? (e.error!.message as string[]).join(', ')
          : (e?.error?.message ?? 'No se pudo guardar');
        this.toastr.error(msg);
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 2 — MÉTODOS
  // ══════════════════════════════════════════════════════════════════════════

  private cargarAniosLectivos(): void {
    this.svc.getAniosLectivos().subscribe({
      next: anios => {
        this.aniosDisponibles.set(anios);
        if (anios.length) this.setAnio(String(anios[0]));
      },
      error: () => {
        this.aniosDisponibles.set([new Date().getFullYear()]);
      },
    });
  }

  setTipoFiltro(tipo: TipoFiltro) {
    this.tipoFiltro.set(tipo);
    this.reporteDetalle.set([]);
    this.reporteResumen.set([]);
    if (tipo === 'bimestre') {
      const activo = this.periodoSvc.activo();
      const primero = this.bimestres()[0];
      const target = activo ?? primero;
      if (target) this.setBimestre(target);
    }
  }

  setBimestre(p: Period) {
    this.filtroBimestre.set(p);
    this.filtroDesde.set(p.fecha_inicio);
    this.filtroHasta.set(p.fecha_fin);
  }

  setAnio(anio: string) {
    this.filtroAnioStr.set(anio);
    this.filtroDesde.set(`${anio}-01-01`);
    this.filtroHasta.set(`${anio}-12-31`);
  }

  buscarReporte() {
    const { fechaInicio, fechaFin } = this.rangoActual();
    this.loadingReporte.set(true);
    this.reporteDetalle.set([]);
    this.reporteResumen.set([]);

    this.svc.getResumenRango(fechaInicio, fechaFin).subscribe({
      next: resumen => {
        this.reporteResumen.set(resumen);
        this.svc.getReporteDiario(fechaInicio).subscribe({
          next: detalle => {
            this.reporteDetalle.set(detalle);
            this.loadingReporte.set(false);
          },
          error: (_e: unknown) => this.loadingReporte.set(false),
        });
      },
      error: (_e: unknown) => {
        this.toastr.error('No se pudo cargar el reporte');
        this.loadingReporte.set(false);
      },
    });
  }

  descargarExcel() {
    this.descargando.set(true);
    this.svc.descargarExcel(this.buildFilters());
    setTimeout(() => this.descargando.set(false), 1500);
  }

  private patchEdicion(docenteId: string, patch: Partial<EstadoEdicion>) {
    const m = new Map(this.edicion());
    const prev = m.get(docenteId) ?? { estado: 'presente' as EstadoDocente };
    m.set(docenteId, { ...prev, ...patch });
    this.edicion.set(m);
  }

  private validarRegistro(): string | null {
    for (const d of this.docentes()) {
      const ed = this.edicion().get(d.docente_id);
      if (ed?.estado === 'justificado' && !ed.motivo_justificacion?.trim()) {
        return `"${d.apellido_paterno} , ${d.docente_nombre}" está justificado pero falta el motivo`;
      }
    }
    return null;
  }

  private buildFilters(): ReporteFilters {
    const tipo = this.tipoFiltro();
    if (tipo === 'dia') return { tipo, fecha: this.filtroFecha() };
    return { tipo, fecha_inicio: this.filtroDesde(), fecha_fin: this.filtroHasta() };
  }

  getAvatarColor(apellido: string): string {
    let h = 0;
    for (const c of apellido) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }

  getInitials(d: DocenteDelDia): string {
    return `${d.docente_nombre.charAt(0)}${d.apellido_paterno.charAt(0)}`.toUpperCase();
  }

  formatHora(hora: string): string { return hora?.slice(0, 5) ?? ''; }

  estadoLabel(e: string): string {
    const map: Record<string, string> = {
      presente: 'Presente', tardanza: 'Tardanza',
      falto: 'Faltó', justificado: 'Justificado', 'sin-registro': 'Sin registro',
    };
    return map[e] ?? e;
  }

  gradoAbreviado(nombre: string): string {
    const match = nombre.match(/^(\d+)/);
    return match ? `${match[1]}°` : nombre;
  }

  volver() { this.router.navigate(['/dashboard/auxiliar']); }
}
import { Component, inject, input, signal, computed, OnInit } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../../../core/auth/auth';
import { CourseService } from '../../../stores/course';
import { Course, Material, LiveClass } from '../../../../../core/models/course';

@Component({
  selector: 'app-tab-contenido',
  standalone: true,
  imports: [
    DatePipe, UpperCasePipe, RouterLink,
    MatIconModule, MatButtonModule, MatExpansionModule,
    MatProgressBarModule, MatMenuModule, MatTooltipModule,
  ],
  templateUrl: './tab-contenido.html',
  styleUrl:    './tab-contenido.scss',
})
export class TabContenido implements OnInit {
  readonly auth  = inject(AuthService);
  private csSvc  = inject(CourseService);
  private dialog = inject(MatDialog);
  private snack  = inject(MatSnackBar);

  courseId = input.required<string>();
  course   = input<Course | null>(null);

  materials    = signal<Material[]>([]);
  liveClasses  = signal<LiveClass[]>([]);


  loadingMaterials   = signal(true);
  loadingLiveClasses = signal(true);


  readonly semanasRange = Array.from({ length: 16 }, (_, i) => i + 1);

  readonly materialIcons: Record<string, string> = {
    pdf: 'picture_as_pdf', video: 'smart_display',
    link: 'link', grabacion: 'videocam', otro: 'attach_file',
  };
  readonly materialColors: Record<string, string> = {
    pdf: '#dc2626', video: '#2563eb',
    link: '#16a34a', grabacion: '#9333ea', otro: '#4b5563',
  };

  materialsPorSemana = computed(() => {
    const map = new Map<number, Material[]>();
    for (const m of this.materials()) {
      const s = m.semana ?? 0;
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(m);
    }
    return map;
  });

  ngOnInit() {
    this.loadAll();
  }

  private loadAll() {
    // Materials
    this.csSvc.getMaterials(this.courseId()).subscribe({
      next: r => { this.materials.set(r.data ?? []); this.loadingMaterials.set(false); },
      error: () => { this.materials.set([]); this.loadingMaterials.set(false); },
    });
    // Live classes
    this.csSvc.getLiveClasses(this.courseId()).subscribe({
      next: r => {
        this.liveClasses.set([...r.data].sort(
          (a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
        ));
        this.loadingLiveClasses.set(false);
      },
      error: () => { this.liveClasses.set([]); this.loadingLiveClasses.set(false); },
    });
   
  }

  materialesEnSemana(n: number): Material[] {
    return this.materialsPorSemana().get(n) ?? [];
  }

  bimestreDeSemana(n: number): number { return Math.ceil(n / 4); }

  progresoSemana(n: number): { vistos: number; total: number; pct: number } {
    const mats = this.materialesEnSemana(n);
    const total = mats.length;
    if (!this.auth.isAlumno() || total === 0) return { vistos: 0, total, pct: 0 };
    const vistos = mats.filter(m => m.visto).length;
    return { vistos, total, pct: Math.round((vistos / total) * 100) };
  }

  estadoClase(lc: LiveClass): 'proxima' | 'en-vivo' | 'finalizada' {
    const inicio = new Date(lc.fecha_hora).getTime();
    const fin = inicio + lc.duracion_min * 60_000;
    const ahora = Date.now();
    if (ahora < inicio - 15 * 60_000) return 'proxima';
    if (ahora > fin) return 'finalizada';
    return 'en-vivo';
  }

  esNuevo(m: Material): boolean {
    if (!m.created_at) return false;
    return (Date.now() - new Date(m.created_at).getTime()) / 86_400_000 <= 7;
  }

  formatSize(bytes?: number | null): string {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  esArchivo(m: Material): boolean {
    return !!(m.storage_key || (m.url && !m.url.startsWith('http')));
  }

  async abrirPreview(m: Material) {
    const { MaterialPreview } = await import(
      '../../../material-preview/material-preview'
    );
    this.dialog.open(MaterialPreview, {
      data: { courseId: this.courseId(), material: m },
      width: '92vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh',
      position: { right: '0', top: '0' },
      panelClass: 'material-preview-pane',
      enterAnimationDuration: 0, exitAnimationDuration: 0,
    });
    this.markVisto(m.id);
  }

  descargar(m: Material) {
    this.csSvc.getMaterialDownload(this.courseId(), m.id).subscribe({
      next: r => { window.open(r.data.url, '_blank'); this.markVisto(m.id); },
      error: () => window.open(m.url, '_blank'),
    });
  }

  private markVisto(id: string) {
    if (!this.auth.isAlumno()) return;
    const cur = this.materials().find(m => m.id === id);
    if (cur?.visto) return;
    this.csSvc.markMaterialViewed(this.courseId(), id).subscribe({
      next: () => this.materials.update(list =>
        list.map(m => m.id === id ? { ...m, visto: true } : m)
      ),
      error: () => {},
    });
  }

  async abrirCrearLiveClass() {
    const { LiveClassFormDialog } = await import(
      '../../live-class-form-dialog/live-class-form-dialog'
    );
    const ref = this.dialog.open(LiveClassFormDialog, {
      data: { courseId: this.courseId() }, width: '600px', maxHeight: '90vh',
    });
    ref.afterClosed().subscribe(r => {
      if (r) this.csSvc.getLiveClasses(this.courseId()).subscribe({
        next: res => this.liveClasses.set(res.data ?? []),
        error: () => {},
      });
    });
  }

  async abrirEditarLiveClass(lc: LiveClass) {
    const { LiveClassFormDialog } = await import(
      '../../live-class-form-dialog/live-class-form-dialog'
    );
    const ref = this.dialog.open(LiveClassFormDialog, {
      data: { courseId: this.courseId(), liveClass: lc }, width: '600px', maxHeight: '90vh',
    });
    ref.afterClosed().subscribe(r => {
      if (r) this.csSvc.getLiveClasses(this.courseId()).subscribe({
        next: res => this.liveClasses.set(res.data ?? []),
        error: () => {},
      });
    });
  }

  eliminarLiveClass(lc: LiveClass) {
    if (!confirm(`¿Eliminar "${lc.titulo}"?`)) return;
    this.csSvc.deleteLiveClass(lc.id).subscribe({
      next: () => {
        this.liveClasses.update(list => list.filter(c => c.id !== lc.id));
        this.snack.open('Videoconferencia eliminada', 'OK', { duration: 3000 });
      },
      error: err => this.snack.open(err?.error?.message ?? 'Error', 'Cerrar', { duration: 3000 }),
    });
  }

  unirseClase(lc: LiveClass) { window.open(lc.link_reunion, '_blank'); }

  iniciales(d?: { nombre?: string; apellido_paterno?: string } | null): string {
    if (!d) return 'D';
    return ((d.nombre?.[0] ?? '') + (d.apellido_paterno?.[0] ?? '')).toUpperCase() || 'D';
  }
}
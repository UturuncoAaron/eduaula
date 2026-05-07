import {
  ChangeDetectionStrategy, Component, computed, input, output,
} from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { SemanaResumen, Material } from '../../../../../../core/models/course';
import { Task } from '../../../../../../core/models/task';
import { Forum } from '../../../../../../core/models/forum';
import { WeekContentSkeleton } from '../../../../../../shared/components/skeletons/skeletons';

export type ItemKind = 'material' | 'tarea' | 'foro';

export interface SemanaItem {
  kind: ItemKind;
  id: string;
  titulo: string;
  descripcion: string | null;
  oculto: boolean;
  fecha: string;
  raw: Material | Task | Forum;
}

interface TipoChip {
  /** Texto del chip ("PDF", "VIDEO", "TAREA", "FORO", …). */
  label: string;
  /** Color base — usado para fondo (alpha 12%) y texto (full). */
  color: string;
}

/**
 * Accordeón de una semana.
 *
 * Render dumb: el padre decide cuándo cargar `items` (al recibir `(opened)`).
 * Mientras `items` es `null` se muestra `WeekContentSkeleton`.
 *
 * Para items `kind === 'material'` se ofrece descarga directa via output
 * `materialDownload` — sin abrir el preview modal.
 *
 * El padre maneja todos los efectos secundarios (dialogs, mutaciones).
 */
@Component({
  selector: 'app-week-accordion',
  standalone: true,
  imports: [
    MatExpansionModule, MatIconModule, MatButtonModule,
    MatMenuModule, MatTooltipModule, MatChipsModule,
    WeekContentSkeleton,
  ],
  templateUrl: './week-accordion.html',
  styleUrl: './week-accordion.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekAccordion {
  semana = input.required<SemanaResumen>();
  /** `null` ⇒ todavía no se cargó; `[]` ⇒ cargado y vacío. */
  items = input<SemanaItem[] | null>(null);
  canManage = input<boolean>(false);

  readonly opened = output<void>();
  readonly itemOpen = output<SemanaItem>();
  readonly itemToggle = output<SemanaItem>();
  readonly itemDelete = output<SemanaItem>();
  readonly materialDownload = output<SemanaItem>();
  readonly toggleSemana = output<SemanaResumen>();
  readonly createMaterial = output<SemanaResumen>();
  readonly createTarea = output<SemanaResumen>();
  readonly createForo = output<SemanaResumen>();

  readonly itemCount = computed(() => this.items()?.length ?? 0);
  readonly isLoading = computed(() => this.items() === null);

  /** Icono Material Symbols por tipo de item. */
  iconOf(item: SemanaItem): string {
    if (item.kind === 'tarea') {
      const t = item.raw as Task;
      return t.permite_alternativas ? 'task_alt' : 'fact_check';
    }
    if (item.kind === 'foro') return 'forum';
    const m = item.raw as Material;
    const map: Record<string, string> = {
      pdf: 'picture_as_pdf', video: 'smart_display',
      link: 'link', grabacion: 'videocam', otro: 'attach_file',
    };
    return map[m.tipo] ?? 'insert_drive_file';
  }

  iconColor(item: SemanaItem): string {
    if (item.kind === 'tarea') return '#1d4ed8';
    if (item.kind === 'foro') return '#0d9488';
    const m = item.raw as Material;
    const map: Record<string, string> = {
      pdf: '#dc2626', video: '#2563eb',
      link: '#16a34a', grabacion: '#9333ea', otro: '#4b5563',
    };
    return map[m.tipo] ?? '#94a3b8';
  }

  /** Chip de tipo (texto + color base) — se muestra junto al título. */
  tipoChip(item: SemanaItem): TipoChip {
    if (item.kind === 'tarea') {
      const t = item.raw as Task;
      return t.permite_alternativas
        ? { label: 'EXAMEN', color: '#9333ea' }
        : { label: 'TAREA', color: '#1d4ed8' };
    }
    if (item.kind === 'foro') return { label: 'FORO', color: '#0d9488' };
    const m = item.raw as Material;
    const map: Record<string, TipoChip> = {
      pdf: { label: 'PDF', color: '#dc2626' },
      video: { label: 'VIDEO', color: '#2563eb' },
      link: { label: 'ENLACE', color: '#16a34a' },
      grabacion: { label: 'GRABACIÓN', color: '#9333ea' },
      otro: { label: 'ARCHIVO', color: '#4b5563' },
    };
    return map[m.tipo] ?? { label: 'ARCHIVO', color: '#64748b' };
  }

  /**
   * Meta-line: incluye fecha relativa, puntos (tareas), tamaño (materiales).
   * Devuelve un array de "chips" textuales que se separan con · en el render.
   */
  metaParts(item: SemanaItem): string[] {
    const parts: string[] = [];
    if (item.kind === 'tarea') {
      const t = item.raw as Task;
      const f = new Date(t.fecha_limite);
      parts.push(`Entrega ${f.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}`);
      parts.push(`${t.puntos_max} pts`);
    } else if (item.kind === 'foro') {
      parts.push('Discusión abierta');
      parts.push(this.relativeDate(item.fecha));
    } else {
      const m = item.raw as Material;
      const size = m.size_bytes ? this.formatSize(m.size_bytes) : null;
      if (size) parts.push(size);
      parts.push(this.relativeDate(item.fecha));
    }
    return parts;
  }

  /** True cuando el item es un material descargable o con URL externa. */
  canDownload(item: SemanaItem): boolean {
    return item.kind === 'material';
  }

  // ── helpers internos ──
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private relativeDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const day = 86_400_000;
    if (diffMs < day) return 'Hoy';
    if (diffMs < 2 * day) return 'Ayer';
    if (diffMs < 7 * day) return `Hace ${Math.floor(diffMs / day)} días`;
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  }
}

import {
  ChangeDetectionStrategy, Component, ElementRef,
  ViewChild,OnInit, OnDestroy, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';

import { PsychologyStore } from '../data-access/psychology.store';

type FirmaMode = 'draw' | 'upload';

@Component({
  selector: 'app-mi-firma',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule, MatButtonToggleModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './mi-firma.html',
  styleUrl: './mi-firma.scss',
})
export class MiFirma implements OnInit, OnDestroy {
  private canvasRef?: ElementRef<HTMLCanvasElement>;

  @ViewChild('padCanvas') set canvasRefSetter(ref: ElementRef<HTMLCanvasElement> | undefined) {
    if (ref && ref !== this.canvasRef) {
      this.canvasRef = ref;
      this.setupCanvas();
    }
  }

  readonly store = inject(PsychologyStore);
  private readonly toastr = inject(ToastService);

  // ── Estado UI ───────────────────────────────────────────────
  readonly mode = signal<FirmaMode>('draw');
  readonly hasStrokes = signal(false);
  readonly previewUrl = signal<string | null>(null); // preview de la imagen subida
  readonly pendingFile = signal<File | null>(null);

  // ── Derivados ───────────────────────────────────────────────
  readonly currentFirma = computed(() => this.store.firmaUrl());
  readonly hasCurrent = computed(() => !!this.currentFirma());
  readonly saving = computed(() => this.store.savingFirma());
  readonly loading = computed(() => this.store.loadingFirma());
  readonly canSave = computed(() => {
    if (this.saving()) return false;
    return this.mode() === 'draw' ? this.hasStrokes() : !!this.pendingFile();
  });

  // ── Canvas internals ────────────────────────────────────────
  private ctx: CanvasRenderingContext2D | null = null;
  private drawing = false;
  private resizeObs?: ResizeObserver;

  // ════════════════════════════════════════════════════════════
  // Ciclo de vida
  // ════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.store.loadMyFirma();
  }



  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
  }

  // ════════════════════════════════════════════════════════════
  // Cambio de modo
  // ════════════════════════════════════════════════════════════

  setMode(m: FirmaMode): void {
    this.mode.set(m);
  }
  // ════════════════════════════════════════════════════════════
  // CANVAS — dibujar firma
  // ════════════════════════════════════════════════════════════

  private setupCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    // High-DPI: el canvas interno tiene tamaño real * dpr para evitar pixelado
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#111';
      this.ctx = ctx;
      // Redibujar nada — fondo transparente
    };

    resize();
    this.resizeObs?.disconnect();
    this.resizeObs = new ResizeObserver(() => resize());
    this.resizeObs.observe(canvas);
  }

  onPointerDown(e: PointerEvent): void {
    if (!this.ctx || !this.canvasRef) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    this.drawing = true;
    const { x, y } = this.getXY(e);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    // Un pequeño punto para que se vea aunque sea tap sin movimiento
    this.ctx.lineTo(x + 0.01, y + 0.01);
    this.ctx.stroke();
    this.hasStrokes.set(true);
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.drawing || !this.ctx) return;
    e.preventDefault();
    const { x, y } = this.getXY(e);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  onPointerUp(e: PointerEvent): void {
    if (!this.drawing) return;
    this.drawing = false;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  private getXY(e: PointerEvent): { x: number; y: number } {
    const canvas = this.canvasRef!.nativeElement;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  clearCanvas(): void {
    if (!this.ctx || !this.canvasRef) return;
    const c = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, c.width, c.height);
    this.hasStrokes.set(false);
  }

  // ════════════════════════════════════════════════════════════
  // UPLOAD — imagen
  // ════════════════════════════════════════════════════════════

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.takeFile(file);
    input.value = ''; // permitir reseleccionar el mismo archivo
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.takeFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private takeFile(file: File): void {
    const okTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!okTypes.includes(file.type)) {
      this.toastr.error('Solo se aceptan imágenes PNG, JPG o WEBP', 'Formato inválido');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.toastr.error('La imagen no puede superar 2 MB', 'Archivo muy grande');
      return;
    }
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
    this.previewUrl.set(URL.createObjectURL(file));
    this.pendingFile.set(file);
  }

  clearPendingFile(): void {
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
    this.previewUrl.set(null);
    this.pendingFile.set(null);
  }

  // ════════════════════════════════════════════════════════════
  // GUARDAR / ELIMINAR
  // ════════════════════════════════════════════════════════════

  async save(): Promise<void> {
    try {
      if (this.mode() === 'draw') {
        const blob = await this.canvasToPngBlob();
        if (!blob) return;
        await this.store.uploadMyFirma(blob, 'firma.png');
      } else {
        const f = this.pendingFile();
        if (!f) return;
        await this.store.uploadMyFirma(f, f.name);
      }
      this.toastr.success('Firma guardada');
      this.clearCanvas();
      this.clearPendingFile();
    } catch {
      this.toastr.error('No se pudo guardar la firma', 'Error');
    }
  }

  private canvasToPngBlob(): Promise<Blob | null> {
    return new Promise(resolve => {
      this.canvasRef?.nativeElement.toBlob(b => resolve(b), 'image/png');
    });
  }

  async deleteFirma(): Promise<void> {
    const ok = window.confirm('¿Eliminar la firma actual? Tus próximos informes saldrán sin firma hasta que cargues una nueva.');
    if (!ok) return;
    try {
      await this.store.deleteMyFirma();
      this.toastr.success('Firma eliminada');
    } catch {
      this.toastr.error('No se pudo eliminar la firma', 'Error');
    }
  }
}
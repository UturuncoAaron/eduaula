import {
  Component, inject, signal, ChangeDetectionStrategy, OnDestroy,
} from '@angular/core';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

type ScanEstado = 'esperando' | 'procesando' | 'ok' | 'duplicado' | 'error';

interface AlumnoInfo {
  id: string;
  nombre_completo: string;
  codigo_estudiante: string;
  seccion: string;
  foto_url: string | null;
}

interface ScanResultado {
  estado: ScanEstado;
  alumno: AlumnoInfo | null;
  asistenciaEstado: string | null;
  mensaje: string | null;
  fotoUrl: SafeUrl | null;
}

@Component({
  selector: 'app-qr-scan',
  standalone: true,
  imports: [ZXingScannerModule, MatIconModule, RouterLink],
  templateUrl: './qr-scan.html',
  styleUrl: './qr-scan.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrScan implements OnDestroy {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  // Controla si la cámara está activa
  readonly camaraActiva = signal(true);

  // Resultado del último escaneo
  readonly resultado = signal<ScanResultado>({
    estado: 'esperando',
    alumno: null,
    asistenciaEstado: null,
    mensaje: null,
    fotoUrl: null,
  });

  // Bloqueo para evitar procesar múltiples scans seguidos
  private procesando = false;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private fotoObjectUrl: string | null = null;

  ngOnDestroy(): void {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    if (this.fotoObjectUrl) URL.revokeObjectURL(this.fotoObjectUrl);
  }

  /**
   * zxing llama esto cada vez que lee un QR con éxito.
   * Bloqueamos para no disparar múltiples veces el mismo scan.
   */
  onScanSuccess(token: string): void {
    if (this.procesando) return;
    this.procesando = true;
    this.camaraActiva.set(false);

    this.resultado.set({
      estado: 'procesando',
      alumno: null,
      asistenciaEstado: null,
      mensaje: null,
      fotoUrl: null,
    });

    this.api.post<{ duplicate: boolean; attendance: any; alumno: AlumnoInfo }>(
      'asistencias/general/scan',
      { qr_token: token },
    ).subscribe({
      next: res => {
        const { duplicate, attendance, alumno } = res.data;
        this.resultado.set({
          estado: duplicate ? 'duplicado' : 'ok',
          alumno,
          asistenciaEstado: attendance?.estado ?? null,
          mensaje: duplicate
            ? 'Ya fue registrado hoy'
            : `Asistencia registrada — ${attendance?.estado ?? ''}`,
          fotoUrl: null,
        });

        // Cargar foto si existe
        if (alumno?.foto_url) {
          this.cargarFoto(alumno.foto_url);
        }

        this.programarReset(4000);
      },
      error: err => {
        const msg = err?.error?.message ?? 'QR inválido o error del servidor';
        this.resultado.set({
          estado: 'error',
          alumno: null,
          asistenciaEstado: null,
          mensaje: msg,
          fotoUrl: null,
        });
        this.programarReset(3000);
      },
    });
  }

  onScanError(err: unknown): void {
    // Errores de lectura del scanner son normales — ignorar silenciosamente
    console.debug('QR scan error (normal):', err);
  }

  /** Vuelve al estado inicial y reactiva la cámara */
  escanearOtro(): void {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    if (this.fotoObjectUrl) {
      URL.revokeObjectURL(this.fotoObjectUrl);
      this.fotoObjectUrl = null;
    }
    this.procesando = false;
    this.resultado.set({
      estado: 'esperando',
      alumno: null,
      asistenciaEstado: null,
      mensaje: null,
      fotoUrl: null,
    });
    this.camaraActiva.set(true);
  }

  private programarReset(ms: number): void {
    this.resetTimer = setTimeout(() => this.escanearOtro(), ms);
  }

  private cargarFoto(storageKey: string): void {
    // La foto viene como storage_key — construir URL del endpoint de storage
    this.http
      .get(`${environment.apiUrl}/storage/${storageKey}`, { responseType: 'blob' })
      .subscribe({
        next: blob => {
          if (this.fotoObjectUrl) URL.revokeObjectURL(this.fotoObjectUrl);
          this.fotoObjectUrl = URL.createObjectURL(blob);
          this.resultado.update(r => ({
            ...r,
            fotoUrl: this.sanitizer.bypassSecurityTrustUrl(this.fotoObjectUrl!),
          }));
        },
        error: () => { /* sin foto — no es crítico */ },
      });
  }

  /** Helper para el template */
  estadoLabel(estado: string | null): string {
    const map: Record<string, string> = {
      asistio: 'Asistió',
      tardanza: 'Tardanza',
      falta: 'Falta',
      justificado: 'Justificado',
    };
    return estado ? (map[estado] ?? estado) : '';
  }
}
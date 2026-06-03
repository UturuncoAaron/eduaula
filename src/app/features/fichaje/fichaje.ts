import {
  Component, signal, computed, inject, OnDestroy, NgZone,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../core/services/api';

type Estado = 'idle' | 'loading' | 'entrada' | 'salida' | 'tardanza' | 'ya_completo' | 'error';

interface FichajeResponse {
  accion: 'entrada' | 'salida' | 'ya_completo';
  mensaje: string;
  nombre: string;
  estado?: 'presente' | 'tardanza';
  hora?: string;
  hora_esperada?: string;
  hora_entrada?: string;
  hora_salida?: string;
}

@Component({
  selector: 'app-fichaje',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule,
  ],
  templateUrl: './fichaje.html',
  styleUrl: './fichaje.scss',
})
export class Fichaje implements OnDestroy {
  private api = inject(ApiService);
  private zone = inject(NgZone);

  estado = signal<Estado>('idle');
  resultado = signal<FichajeResponse | null>(null);
  errorMsg = signal('');
  showPassword = signal(false);

  private resetTimer?: ReturnType<typeof setTimeout>;

  form = new FormGroup({
    codigo_acceso: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  iconoEstado = computed(() => {
    switch (this.estado()) {
      case 'entrada': return 'login';
      case 'salida': return 'logout';
      case 'tardanza': return 'schedule';
      case 'ya_completo': return 'check_circle';
      case 'error': return 'error_outline';
      default: return 'badge';
    }
  });

  colorEstado = computed(() => {
    switch (this.estado()) {
      case 'entrada': return '#10b981';
      case 'salida': return '#3b82f6';
      case 'tardanza': return '#f59e0b';
      case 'ya_completo': return '#6366f1';
      case 'error': return '#ef4444';
      default: return '#64748b';
    }
  });

  submit(): void {
    if (this.form.invalid || this.estado() === 'loading') return;
    this.clearTimer();
    this.estado.set('loading');
    this.errorMsg.set('');

    const { codigo_acceso, password } = this.form.getRawValue();

    this.api.post<FichajeResponse>('fichaje', { codigo_acceso, password }).subscribe({
      next: (res) => {
        const data = (res as any)?.data ?? res;
        this.resultado.set(data);

        if (data.accion === 'entrada' && data.estado === 'tardanza') {
          this.estado.set('tardanza');
        } else if (data.accion === 'entrada') {
          this.estado.set('entrada');
        } else if (data.accion === 'salida') {
          this.estado.set('salida');
        } else {
          this.estado.set('ya_completo');
        }

        this.scheduleReset(4000);
      },
      error: (err) => {
        const msg = err?.error?.message ?? err?.message ?? 'Credenciales incorrectas';
        this.errorMsg.set(Array.isArray(msg) ? msg.join(', ') : msg);
        this.estado.set('error');
        this.scheduleReset(3500);
      },
    });
  }

  private scheduleReset(ms: number): void {
    this.clearTimer();
    this.resetTimer = setTimeout(() => {
      this.zone.run(() => this.reset());
    }, ms);
  }

  private clearTimer(): void {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  reset(): void {
    this.estado.set('idle');
    this.resultado.set(null);
    this.errorMsg.set('');
    this.form.reset();
    this.showPassword.set(false);
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }
}
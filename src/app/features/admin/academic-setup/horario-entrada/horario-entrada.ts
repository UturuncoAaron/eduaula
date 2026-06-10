import { Component, inject, signal, ChangeDetectionStrategy, OnInit, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../../core/services/api';

interface HorarioEntradaDia {
  dia_semana: string;
  hora_limite: string;
  label: string;
}

const DIAS_CONFIG: readonly { dia_semana: string; label: string }[] = [
  { dia_semana: 'lunes', label: 'Lunes' },
  { dia_semana: 'martes', label: 'Martes' },
  { dia_semana: 'miercoles', label: 'Miércoles' },
  { dia_semana: 'jueves', label: 'Jueves' },
  { dia_semana: 'viernes', label: 'Viernes' },
];

@Component({
  selector: 'app-horario-entrada',
  standalone: true,
  imports: [MatIconModule, FormsModule],
  templateUrl: './horario-entrada.html',
  styleUrl: './horario-entrada.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HorarioEntrada implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toastr = inject(ToastService);

  readonly loading = signal<boolean>(true);
  readonly saving = signal<boolean>(false);
  readonly horarios = signal<HorarioEntradaDia[]>([]);

  // Estado para el control masivo global
  readonly horaGlobal = signal<string>('07:30');

  // Evalúa si hubo cambios reales contra lo guardado (Mantenibilidad / UX)
  private originalData: string = '';
  readonly hasChanges = computed(() => {
    return JSON.stringify(this.horarios()) !== this.originalData;
  });

  ngOnInit(): void {
    this.cargarConfiguracion();
  }

  private cargarConfiguracion(): void {
    this.api.get<HorarioEntradaDia[]>('admin/config/horario-entrada').subscribe({
      next: res => {
        const data = (res as any).data ?? res;
        const listadoMap = DIAS_CONFIG.map(d => ({
          ...d,
          hora_limite: data.find((x: any) => x.dia_semana === d.dia_semana)?.hora_limite ?? '07:30',
        }));
        this.horarios.set(listadoMap);
        this.originalData = JSON.stringify(listadoMap);
        this.loading.set(false);
      },
      error: () => {
        const fallback = DIAS_CONFIG.map(d => ({ ...d, hora_limite: '07:30' }));
        this.horarios.set(fallback);
        this.originalData = JSON.stringify(fallback);
        this.loading.set(false);
      },
    });
  }

  updateHoraIndividual(dia: string, valor: string): void {
    if (!valor) return;
    this.horarios.update(list =>
      list.map(h => h.dia_semana === dia ? { ...h, hora_limite: valor } : h)
    );
  }

  aplicarHoraMasiva(): void {
    const hora = this.horaGlobal();
    this.horarios.update(list => list.map(h => ({ ...h, hora_limite: hora })));
    this.toastr.success(`Se asignó ${hora} a todos los días laborables.`);
  }

  guardar(): void {
    if (this.saving() || !this.hasChanges()) return;
    this.saving.set(true);

    const payload = {
      horarios: this.horarios().map(({ dia_semana, hora_limite }) => ({ dia_semana, hora_limite })),
    };

    this.api.post('admin/config/horario-entrada', payload).subscribe({
      next: () => {
        this.toastr.success('Configuración guardada correctamente', 'Éxito');
        this.originalData = JSON.stringify(this.horarios());
        this.saving.set(false);
      },
      error: () => {
        this.toastr.error('Ocurrió un error al guardar la configuración');
        this.saving.set(false);
      },
    });
  }
}
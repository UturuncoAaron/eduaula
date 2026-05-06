import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../core/services/api';

export interface ConfigItem {
  clave: string;
  valor: string;
  descripcion: string | null;
  label: string;       // etiqueta legible para el formulario
  tipo: 'text' | 'number';
  icon: string;
}

// Mapeo de claves a metadatos de UI
const CONFIG_META: Record<string, Pick<ConfigItem, 'label' | 'tipo' | 'icon'>> = {
  nombre_colegio: { label: 'Nombre del colegio', tipo: 'text', icon: 'school' },
  ugel: { label: 'UGEL', tipo: 'text', icon: 'account_balance' },
  director: { label: 'Director', tipo: 'text', icon: 'person' },
  anio_escolar: { label: 'Año escolar', tipo: 'number', icon: 'calendar_today' },
  semanas_por_bimestre: { label: 'Semanas por bimestre', tipo: 'number', icon: 'view_week' },
  max_tam_archivo_mb: { label: 'Tamaño máximo de archivo (MB)', tipo: 'number', icon: 'upload_file' },
};

@Component({
  selector: 'app-system-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule, MatTooltipModule,
  ],
  templateUrl: './system-settings.html',
  styleUrl: './system-settings.scss',
})
export class SystemSettings implements OnInit {
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private fb = inject(FormBuilder);

  loading = signal(true);
  saving = signal(false);
  items = signal<ConfigItem[]>([]);

  form!: FormGroup;

  ngOnInit(): void {
    this.api.get<{ clave: string; valor: string; descripcion: string | null }[]>(
      'admin/configuracion',
    ).subscribe({
      next: (r: any) => {
        const raw: { clave: string; valor: string; descripcion: string | null }[] = r.data ?? [];

        // Construir lista de items solo con las claves conocidas
        const items: ConfigItem[] = raw
          .filter(c => CONFIG_META[c.clave])
          .map(c => ({
            ...c,
            ...CONFIG_META[c.clave],
          }));

        this.items.set(items);

        // Construir FormGroup dinámico
        const controls: Record<string, any> = {};
        items.forEach(item => {
          controls[item.clave] = [
            item.tipo === 'number' ? Number(item.valor) : item.valor,
            item.tipo === 'number'
              ? [Validators.required, Validators.min(1)]
              : [Validators.required],
          ];
        });
        this.form = this.fb.group(controls);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toastr.error('Error al cargar configuración', 'Error');
      },
    });
  }

  guardar(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    // Construir array de cambios
    const cambios = this.items().map(item => ({
      clave: item.clave,
      valor: String(this.form.value[item.clave]),
    }));

    this.api.patch('admin/configuracion', { items: cambios }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toastr.success('Configuración guardada correctamente', 'Éxito');
        // Marcar el form como pristine
        this.form.markAsPristine();
      },
      error: () => {
        this.saving.set(false);
        this.toastr.error('Error al guardar configuración', 'Error');
      },
    });
  }

  resetear(): void {
    // Restaurar los valores originales cargados desde la API
    this.items().forEach(item => {
      this.form.get(item.clave)?.setValue(
        item.tipo === 'number' ? Number(item.valor) : item.valor,
      );
    });
    this.form.markAsPristine();
  }

  get hayDirty(): boolean {
    return this.form?.dirty ?? false;
  }
}
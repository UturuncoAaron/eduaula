import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { lastValueFrom } from 'rxjs';

export interface HorarioLaboralDialogData {
  cuenta_id: string;
  nombre: string;
}

interface DiaConfig {
  key: string;
  label: string;
}

const DIAS: DiaConfig[] = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
];

@Component({
  selector: 'app-horario-laboral-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="header-main">
          <div class="icon-wrapper">
            <mat-icon>schedule</mat-icon>
          </div>
          <div class="title-wrapper">
            <span class="subtitle">Gestión de Horario</span>
            <h2 class="user-name">{{ data.nombre }}</h2>
          </div>
        </div>
        <button class="close-btn" mat-icon-button mat-dialog-close aria-label="Cerrar modal">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content class="dialog-body">
        @if (loadingHorarios()) {
          <div class="loading-state">
            <div class="spinner-ring"></div>
            <p>Cargando horarios establecidos...</p>
          </div>
        } @else {
          <form [formGroup]="form" class="modern-form">
            <div class="info-alert">
              <mat-icon class="info-icon">info_outline</mat-icon>
              <p class="section-hint">
                Deje vacíos los días que no aplican. Solo se guardarán los días que cuenten con ambas horas completadas.
              </p>
            </div>

            <div class="horario-card-container">
              <div class="horario-table-header">
                <span class="col-title">Día de la Semana</span>
                <span class="col-title">Hora Entrada</span>
                <span class="col-title">Hora Salida</span>
              </div>
              
              <div class="horario-rows">
                @for (dia of dias; track dia.key) {
                  <div class="horario-row">
                    <div class="dia-column">
                      <span class="dia-label">{{ dia.label }}</span>
                    </div>
                    <div class="input-column">
                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width-field">
                        <mat-label>Entrada</mat-label>
                        <input matInput [formControlName]="dia.key + '_inicio'" type="time" />
                      </mat-form-field>
                    </div>
                    <div class="input-column">
                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width-field">
                        <mat-label>Salida</mat-label>
                        <input matInput [formControlName]="dia.key + '_fin'" type="time" />
                      </mat-form-field>
                    </div>
                  </div>
                }
              </div>
            </div>

            @if (error()) {
              <div class="status-alert alert-error">
                <mat-icon>error_outline</mat-icon> 
                <span>{{ error() }}</span>
              </div>
            }
          </form>
        }
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button mat-button mat-dialog-close [disabled]="busy()" class="btn-cancel">
          Cancelar
        </button>
        <button mat-flat-button (click)="submit()" [disabled]="busy() || loadingHorarios()" class="btn-save">
          @if (busy()) { 
            <span class="spinner-inline"></span>
            <span>Guardando...</span>
          } @else { <ng-container>
            <mat-icon>save</mat-icon>
            <span>Guardar horarios</span>
          </ng-container>}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --primary-color: #1e3a8a;
      --primary-hover: #1d4ed8;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --bg-surface: #ffffff;
      --bg-body: #f8fafc;
      --border-color: #e2e8f0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .dialog-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 650px; /* Incrementado para dar más aire a los inputs de tiempo */
      background: var(--bg-surface);
      box-sizing: border-box;
    }

    /* Header */
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 24px;
      border-bottom: 1px solid var(--border-color);
    }
    .header-main {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background-color: #f1f5f9;
      color: var(--primary-color);
      border-radius: 8px;
    }
    .title-wrapper {
      display: flex;
      flex-direction: column;
    }
    .subtitle {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 600;
    }
    .user-name {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .close-btn {
      color: var(--text-muted);
    }

    /* Body */
    .dialog-body {
      padding: 20px 24px;
      max-height: 60vh;
      overflow-y: auto;
      background: var(--bg-body);
      margin: 0;
    }

    /* Alerta Informativa */
    .info-alert {
      display: flex;
      gap: 12px;
      background-color: #f0f7ff;
      border: 1px solid #e0f2fe;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }
    .info-icon {
      color: #0284c7;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .section-hint {
      margin: 0;
      font-size: 0.85rem;
      color: #0369a1;
      line-height: 1.4;
    }

    /* Contenedor Principal de la Tabla/Lista */
    .horario-card-container {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }

    /* Fila de Encabezados (Para desktop) */
    .horario-table-header {
      display: grid;
      grid-template-columns: 140px 1fr 1fr;
      gap: 20px;
      padding: 12px 20px;
      background: #f8fafc;
      border-bottom: 1px solid var(--border-color);
    }
    .col-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    /* Filas de Datos */
    .horario-rows {
      display: flex;
      flex-direction: column;
    }
    .horario-row {
      display: grid;
      grid-template-columns: 140px 1fr 1fr;
      gap: 20px;
      padding: 14px 20px;
      align-items: center;
      border-bottom: 1px solid #f1f5f9;
    }
    .horario-row:last-child {
      border-bottom: none;
    }

    .dia-label {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-main);
    }
    .full-width-field {
      width: 100%;
    }

    /* Inputs de Angular Material Corrección de Ancho Interno */
    ::v-deep .mat-mdc-text-field-wrapper {
      background-color: #ffffff !important;
    }
    ::v-deep input[type="time"] {
      min-width: 110px; /* Evita que el texto de am/pm se comprima u oculte */
    }

    /* Footer */
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid var(--border-color);
      background: var(--bg-surface);
    }
    .btn-cancel {
      color: var(--text-muted);
      font-weight: 600;
    }
    .btn-save {
      background-color: #1e3a8a !important;
      color: #ffffff !important;
      font-weight: 600;
      padding: 0 20px;
      border-radius: 6px;
    }

    /* Estados de Carga y Errores */
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 0;
      color: var(--text-muted);
    }
    .spinner-ring {
      width: 28px;
      height: 28px;
      border: 3px solid var(--border-color);
      border-top-color: var(--primary-color);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 12px;
    }
    .status-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-radius: 6px;
      margin-top: 16px;
      font-size: 0.85rem;
    }
    .alert-error {
      background-color: #fef2f2;
      color: #991b1b;
      border: 1px solid #fca5a5;
    }
    .spinner-inline {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      display: inline-block;
      margin-right: 6px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* --- RESPONSIVIDAD ADAPTATIVA AVANZADA --- */
    @media (max-width: 580px) {
      .horario-table-header {
        display: none; /* Elimina la cabecera rígida en pantallas compactas */
      }
      .horario-row {
        grid-template-columns: 1fr 1fr; /* Pasa a estructura de dos columnas de inputs */
        gap: 12px;
        padding: 16px;
      }
      .dia-column {
        grid-column: span 2; /* El nombre del día se ubica arriba de ambos inputs */
        border-bottom: 1px dashed var(--border-color);
        padding-bottom: 4px;
        margin-bottom: 4px;
      }
      .dialog-body {
        padding: 12px;
      }
      .horario-card-container {
        border-radius: 6px;
      }
    }
  `],
})
export class HorarioLaboralDialog implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private dialogRef = inject(MatDialogRef<HorarioLaboralDialog>);
  readonly data = inject<HorarioLaboralDialogData>(MAT_DIALOG_DATA);

  readonly dias = DIAS;

  busy = signal(false);
  error = signal('');
  loadingHorarios = signal(true);

  form: FormGroup = this.fb.group(
    DIAS.reduce((acc, d) => ({
      ...acc,
      [d.key + '_inicio']: [''],
      [d.key + '_fin']: [''],
    }), {} as Record<string, any>),
  );

  ngOnInit(): void {
    this.api.get<any>(`fichaje/horarios/${this.data.cuenta_id}`).subscribe({
      next: (res) => {
        const rows: { dia_semana: string; hora_inicio: string; hora_fin: string }[] =
          res?.data ?? res ?? [];

        for (const row of rows) {
          const ini = this.form.get(row.dia_semana + '_inicio');
          const fin = this.form.get(row.dia_semana + '_fin');
          if (ini) ini.setValue(row.hora_inicio?.slice(0, 5) ?? '');
          if (fin) fin.setValue(row.hora_fin?.slice(0, 5) ?? '');
        }
        this.loadingHorarios.set(false);
      },
      error: () => {
        this.error.set('No se pudieron recuperar los horarios del servidor.');
        this.loadingHorarios.set(false);
      },
    });
  }

  async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set('');

    const v = this.form.getRawValue();
    const tareas: Promise<any>[] = [];

    for (const dia of DIAS) {
      const inicio = v[dia.key + '_inicio']?.trim();
      const fin = v[dia.key + '_fin']?.trim();

      if (inicio && fin) {
        const sendObs = this.api.post(`fichaje/horarios/${this.data.cuenta_id}`, {
          dia_semana: dia.key,
          hora_inicio: inicio.length === 5 ? inicio + ':00' : inicio,
          hora_fin: fin.length === 5 ? fin + ':00' : fin,
        });
        tareas.push(lastValueFrom(sendObs));
      } else if (!inicio && !fin) {
        const delObs = this.api.delete(`fichaje/horarios/${this.data.cuenta_id}/${dia.key}`);
        tareas.push(
          lastValueFrom(delObs).catch(() => null)
        );
      }
    }

    try {
      await Promise.all(tareas);
      this.toastr.success('Horarios guardados correctamente', '¡Éxito!');
      this.dialogRef.close(true);
    } catch {
      this.error.set('Error en el servidor al intentar actualizar los horarios.');
    } finally {
      this.busy.set(false);
    }
  }
}
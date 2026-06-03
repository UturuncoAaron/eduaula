import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';

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
        ReactiveFormsModule, MatDialogModule,
        MatFormFieldModule, MatInputModule,
        MatButtonModule, MatIconModule,
    ],
    template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="dialog-header-modern">
          <div class="header-main">
            <div class="create-icon" style="background:#1e3a5f18;color:#1e3a5f">
              <mat-icon>schedule</mat-icon>
            </div>
            <div class="user-info">
              <p class="eyebrow">Horario laboral</p>
              <h2 class="user-name">{{ data.nombre }}</h2>
            </div>
          </div>
          <button class="close-btn" mat-dialog-close><mat-icon>close</mat-icon></button>
        </div>
      </div>

      <mat-dialog-content class="dialog-body">
        @if (loadingHorarios()) {
          <div class="loading-state">
            <div class="spinner-ring"></div>
            <p>Cargando horarios...</p>
          </div>
        } @else {
          <form [formGroup]="form" class="modern-form">
            <p class="section-hint" style="margin-bottom:16px">
              Deja vacío los días que no aplican. Solo se guardan los días con ambas horas completas.
            </p>
            <div class="horario-table">
              <div class="horario-header">
                <span>Día</span>
                <span>Entrada</span>
                <span>Salida</span>
              </div>
              @for (dia of dias; track dia.key) {
              <div class="horario-row">
                <span class="dia-label">{{ dia.label }}</span>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <input matInput [formControlName]="dia.key + '_inicio'"
                         placeholder="07:30" maxlength="8" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <input matInput [formControlName]="dia.key + '_fin'"
                         placeholder="16:00" maxlength="8" />
                </mat-form-field>
              </div>
              }
            </div>

            @if (error()) {
            <div class="status-alert alert-error" style="margin-top:12px">
              <mat-icon>error_outline</mat-icon> {{ error() }}
            </div>
            }
          </form>
        }
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button mat-button mat-dialog-close [disabled]="busy()">Cancelar</button>
        <button mat-flat-button (click)="submit()" [disabled]="busy() || loadingHorarios()"
                style="background:#1e3a5f;color:#fff">
          @if (busy()) { <span class="spinner"></span> }
          @if (!busy()) { <mat-icon>save</mat-icon> }
          <span>{{ busy() ? 'Guardando...' : 'Guardar horarios' }}</span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
    styles: [`
    .horario-table {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .horario-header {
      display: grid;
      grid-template-columns: 110px 1fr 1fr;
      gap: 12px;
      font-size: 0.78rem;
      font-weight: 600;
      color: #64748b;
      padding: 0 4px;
    }
    .horario-row {
      display: grid;
      grid-template-columns: 110px 1fr 1fr;
      gap: 12px;
      align-items: center;
    }
    .dia-label {
      font-size: 0.9rem;
      font-weight: 500;
      color: #0f172a;
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
                tareas.push(
                    this.api.post(`fichaje/horarios/${this.data.cuenta_id}`, {
                        dia_semana: dia.key,
                        hora_inicio: inicio.length === 5 ? inicio + ':00' : inicio,
                        hora_fin: fin.length === 5 ? fin + ':00' : fin,
                    }).toPromise(),
                );
            } else if (!inicio && !fin) {
                tareas.push(
                    this.api.delete(`fichaje/horarios/${this.data.cuenta_id}/${dia.key}`)
                        .toPromise()
                        .catch(() => null),
                );
            }
        }

        try {
            await Promise.all(tareas);
            this.toastr.success('Horarios guardados correctamente', '¡Éxito!');
            this.dialogRef.close(true);
        } catch {
            this.error.set('Error al guardar algunos horarios');
        } finally {
            this.busy.set(false);
        }
    }
}
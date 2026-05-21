import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

export interface CambiarSeccionData {
  alumno: string;
  gradoNombre: string;
  seccionActualNombre: string;
  secciones: { id: string; nombre: string }[];
}

@Component({
  selector: 'app-cambiar-seccion-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatSelectModule, MatFormFieldModule,
  ],
  template: `
    <h2 mat-dialog-title>Cambiar sección</h2>

    <mat-dialog-content>
      <p class="alumno">{{ data.alumno }}</p>
      <p class="info">
        Actualmente en <strong>{{ data.gradoNombre }}</strong>
        — Sección <strong>{{ data.seccionActualNombre }}</strong>
      </p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Nueva sección</mat-label>
        <mat-select [formControl]="seccionCtrl" disableOptionCentering>
          @for (s of data.secciones; track s.id) {
            <mat-option [value]="s.id">Sección {{ s.nombre }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary"
              [disabled]="seccionCtrl.invalid"
              (click)="confirmar()">
        Cambiar sección
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .alumno     { font-weight: 600; font-size: 15px; margin: 0 0 4px; }
    .info       { font-size: 13px; color: #666; margin: 0 0 4px; }
    .full-width { width: 100%; margin-top: 12px; }
    mat-dialog-actions { padding: 8px 24px 16px; gap: 8px; }
  `],
})
export class CambiarSeccionDialog {
  readonly data = inject<CambiarSeccionData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<CambiarSeccionDialog>);

  seccionCtrl = new FormControl<string | null>(null, Validators.required);

  confirmar(): void {
    if (this.seccionCtrl.valid) this.ref.close(this.seccionCtrl.value);
  }
}
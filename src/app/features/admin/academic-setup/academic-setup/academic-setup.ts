import { Component, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-academic-setup',
  standalone: true,
  imports: [MatCardModule, MatTabsModule, MatIconModule, MatButtonModule, PageHeader],
  templateUrl: './academic-setup.html',
  styleUrl: './academic-setup.scss',
})
export class AcademicSetup {
  grados = signal([
    { nombre: '1ro de Primaria', nivel: 'primaria' },
    { nombre: '3ro de Secundaria', nivel: 'secundaria' },
  ]);
  periodos = signal([
    { nombre: '2025 - Bimestre 1', activo: true },
    { nombre: '2025 - Bimestre 2', activo: false },
  ]);
}
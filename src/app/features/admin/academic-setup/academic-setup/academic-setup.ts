import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { GradosTab } from '../grados-tab/grados-tab';
import { PeriodosTab } from '../periodos-tab/periodos-tab';

@Component({
  selector: 'app-academic-setup',
  imports: [MatTabsModule, MatIconModule, GradosTab, PeriodosTab],
  templateUrl: './academic-setup.html',
  styleUrl: './academic-setup.scss',
})
export class AcademicSetup { }
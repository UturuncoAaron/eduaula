import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ExportGradesTab } from './tabs/export-grades-tab/export-grades-tab';
import { SectionReportTab } from './tabs/section-report-tab/section-report-tab';
import { TeacherAttendanceTab } from './tabs/teacher-attendance-tab/teacher-attendance-tab';
// CORREGIDO: Importamos el nuevo componente standalone de Staff
import { StaffAttendanceTab } from './tabs/staff-attendance-tab/staff-attendance-tab';

// CORREGIDO: Agregamos 'staff' a la firma de tipos para que el HTML la reconozca sin errores
export type ReportType = 'grades' | 'sections' | 'teachers' | 'staff';

@Component({
  selector: 'app-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatListModule,
    MatIconModule,
    PageHeader,
    ExportGradesTab,
    SectionReportTab,
    TeacherAttendanceTab,
    StaffAttendanceTab,
  ],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  readonly reporteActivo = signal<ReportType>('grades');

  cambiarReporte(tipo: ReportType): void {
    if (this.reporteActivo() !== tipo) {
      this.reporteActivo.set(tipo);
    }
  }
}
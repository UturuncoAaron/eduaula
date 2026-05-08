import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ExportGradesTab } from './tabs/export-grades-tab/export-grades-tab';
import { SectionReportTab } from './tabs/section-report-tab/section-report-tab';
import { TeacherAttendanceTab } from './tabs/teacher-attendance-tab/teacher-attendance-tab';

@Component({
  selector: 'app-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTabsModule,
    MatProgressBarModule,
    PageHeader,
    ExportGradesTab,
    SectionReportTab,
    TeacherAttendanceTab,
  ],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  readonly tabActivo = signal(0);

  onTabChange(i: number): void {
    this.tabActivo.set(i);
  }
}

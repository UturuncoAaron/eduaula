import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'gradeScale', standalone: true })
export class GradeScalePipe implements PipeTransform {
  transform(nota: number | null | undefined): string {
    if (nota == null) return '—';
    if (nota >= 18) return 'AD';
    if (nota >= 14) return 'A';
    if (nota >= 11) return 'B';
    return 'C';
  }
}
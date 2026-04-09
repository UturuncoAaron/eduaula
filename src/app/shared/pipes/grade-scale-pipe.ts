import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'gradeScale',
})
export class GradeScalePipe implements PipeTransform {
  transform(value: unknown, ...args: unknown[]): unknown {
    return null;
  }
}

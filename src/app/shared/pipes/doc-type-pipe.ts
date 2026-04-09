import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'docType',
})
export class DocTypePipe implements PipeTransform {
  transform(value: unknown, ...args: unknown[]): unknown {
    return null;
  }
}

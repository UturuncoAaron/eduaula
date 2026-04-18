import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'docType', standalone: true })
export class DocTypePipe implements PipeTransform {
  transform(value: string): string {
    const map: Record<string, string> = {
      dni: 'DNI',
      ce: 'Carné de Extranjería',
      pasaporte: 'Pasaporte',
    };
    return map[value] ?? value.toUpperCase();
  }
}
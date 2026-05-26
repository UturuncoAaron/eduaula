import { Injectable, signal } from '@angular/core';

@Injectable()
export class BimestreFilterService {
  private _bimestre = signal<number | null>(null);

  readonly bimestre = this._bimestre.asReadonly();

  set(bimestre: number | null): void {
    this._bimestre.set(bimestre);
  }
}
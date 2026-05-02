import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabDisponibilidad } from './tab-disponibilidad';

describe('TabDisponibilidad', () => {
  let component: TabDisponibilidad;
  let fixture: ComponentFixture<TabDisponibilidad>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabDisponibilidad],
    }).compileComponents();

    fixture = TestBed.createComponent(TabDisponibilidad);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

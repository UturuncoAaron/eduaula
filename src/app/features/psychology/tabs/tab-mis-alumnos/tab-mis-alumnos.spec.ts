import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabMisAlumnos } from './tab-mis-alumnos';

describe('TabMisAlumnos', () => {
  let component: TabMisAlumnos;
  let fixture: ComponentFixture<TabMisAlumnos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabMisAlumnos],
    }).compileComponents();

    fixture = TestBed.createComponent(TabMisAlumnos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

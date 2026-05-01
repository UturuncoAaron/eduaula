import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PsychologyDashboard } from './psychology-dashboard';

describe('PsychologyDashboard', () => {
  let component: PsychologyDashboard;
  let fixture: ComponentFixture<PsychologyDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PsychologyDashboard],
    }).compileComponents();

    fixture = TestBed.createComponent(PsychologyDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

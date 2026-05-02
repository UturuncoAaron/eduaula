import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppointmentFormDialog } from './appointment-form-dialog';

describe('AppointmentFormDialog', () => {
  let component: AppointmentFormDialog;
  let fixture: ComponentFixture<AppointmentFormDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppointmentFormDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentFormDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

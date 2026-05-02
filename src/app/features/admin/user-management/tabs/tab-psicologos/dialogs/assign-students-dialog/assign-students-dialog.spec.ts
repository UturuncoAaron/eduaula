import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignStudentsDialog } from './assign-students-dialog';

describe('AssignStudentsDialog', () => {
  let component: AssignStudentsDialog;
  let fixture: ComponentFixture<AssignStudentsDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignStudentsDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(AssignStudentsDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecordFormDialog } from './record-form-dialog';

describe('RecordFormDialog', () => {
  let component: RecordFormDialog;
  let fixture: ComponentFixture<RecordFormDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecordFormDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(RecordFormDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlockFormDialog } from './block-form-dialog';

describe('BlockFormDialog', () => {
  let component: BlockFormDialog;
  let fixture: ComponentFixture<BlockFormDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlockFormDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(BlockFormDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

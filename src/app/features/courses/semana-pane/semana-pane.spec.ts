import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SemanaPane } from './semana-pane';

describe('SemanaPane', () => {
  let component: SemanaPane;
  let fixture: ComponentFixture<SemanaPane>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SemanaPane],
    }).compileComponents();

    fixture = TestBed.createComponent(SemanaPane);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

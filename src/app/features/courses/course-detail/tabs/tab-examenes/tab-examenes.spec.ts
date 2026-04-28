import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabExamenes } from './tab-examenes';

describe('TabExamenes', () => {
  let component: TabExamenes;
  let fixture: ComponentFixture<TabExamenes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabExamenes],
    }).compileComponents();

    fixture = TestBed.createComponent(TabExamenes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

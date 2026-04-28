import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabTareas } from './tab-tareas';

describe('TabTareas', () => {
  let component: TabTareas;
  let fixture: ComponentFixture<TabTareas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabTareas],
    }).compileComponents();

    fixture = TestBed.createComponent(TabTareas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabMateriales } from './tab-materiales';

describe('TabMateriales', () => {
  let component: TabMateriales;
  let fixture: ComponentFixture<TabMateriales>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabMateriales],
    }).compileComponents();

    fixture = TestBed.createComponent(TabMateriales);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

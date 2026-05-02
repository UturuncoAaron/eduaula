import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabFichas } from './tab-fichas';

describe('TabFichas', () => {
  let component: TabFichas;
  let fixture: ComponentFixture<TabFichas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabFichas],
    }).compileComponents();

    fixture = TestBed.createComponent(TabFichas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

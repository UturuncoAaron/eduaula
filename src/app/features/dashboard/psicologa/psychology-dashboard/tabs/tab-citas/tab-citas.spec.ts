import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabCitas } from './tab-citas';

describe('TabCitas', () => {
  let component: TabCitas;
  let fixture: ComponentFixture<TabCitas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabCitas],
    }).compileComponents();

    fixture = TestBed.createComponent(TabCitas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

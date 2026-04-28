import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MySubmissionView } from './my-submission-view';

describe('MySubmissionView', () => {
  let component: MySubmissionView;
  let fixture: ComponentFixture<MySubmissionView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MySubmissionView],
    }).compileComponents();

    fixture = TestBed.createComponent(MySubmissionView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

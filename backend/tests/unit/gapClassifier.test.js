import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateSkillGap,
  classifyGap,
  getPriorityFromGap,
} from '../../src/utils/gapClassifier.js';

describe('gap classifier utilities', () => {
  it('never returns a negative skill gap', () => {
    assert.equal(calculateSkillGap(70, 95), 0);
  });

  it('rounds positive skill gaps to two decimals', () => {
    assert.equal(calculateSkillGap(82.456, 67.111), 15.35);
  });

  it('classifies each threshold boundary', () => {
    assert.equal(classifyGap(0), 'No Gap');
    assert.equal(classifyGap(5), 'Very Low Gap');
    assert.equal(classifyGap(15), 'Low Gap');
    assert.equal(classifyGap(25), 'Moderate Gap');
    assert.equal(classifyGap(25.01), 'High Gap');
  });

  it('maps gap level to recommendation priority', () => {
    assert.equal(getPriorityFromGap('High Gap'), 'high');
    assert.equal(getPriorityFromGap('Moderate Gap'), 'medium');
    assert.equal(getPriorityFromGap('Low Gap'), 'low');
  });
});

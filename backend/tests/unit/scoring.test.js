import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateWeightedScore,
  validateScoreInputs,
} from '../../src/utils/scoring.js';

describe('scoring utilities', () => {
  it('calculates the weighted practical and quiz score', () => {
    assert.equal(
      calculateWeightedScore({
        practicalTaskScore: 80,
        quizScore: 50,
      }),
      71,
    );
  });

  it('normalizes numeric string scores before validation', () => {
    assert.deepEqual(
      validateScoreInputs({
        practicalTaskScore: '90',
        quizScore: '75.5',
      }),
      {
        isValid: true,
        scores: {
          practicalTaskScore: 90,
          quizScore: 75.5,
        },
      },
    );
  });

  it('rejects out-of-range scores with the invalid field name', () => {
    assert.deepEqual(
      validateScoreInputs({
        practicalTaskScore: 101,
        quizScore: 80,
      }),
      {
        isValid: false,
        field: 'practicalTaskScore',
      },
    );
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hideCorrectAnswers } from '../../src/services/competencyService.js';

describe('hideCorrectAnswers', () => {
  it('strips hidden test cases and correct answers from the learner-facing competency', () => {
    const competency = {
      title: 'Backend APIs',
      practicalTasks: [
        {
          _id: 'task-1',
          title: 'Build a REST API',
          automatedTestCommand: 'npm test',
          automatedTestFiles: [{ path: 'tests/hidden.test.js', content: 'secret test code' }],
          publicTestCases: [{ id: 'p1', input: '1', expectedOutput: '2' }],
          hiddenTestCases: [{ id: 'h1', input: 'secret-input', expectedOutput: 'secret-output' }],
          allowedLanguages: ['javascript'],
          executionInterface: 'stdin_stdout',
        },
      ],
      theoryQuestions: [
        { _id: 'q1', question: 'What is REST?', correctAnswer: 'the-correct-answer' },
      ],
    };

    const safe = hideCorrectAnswers(competency);
    const serialized = JSON.stringify(safe);

    assert.equal(safe.practicalTasks[0].hiddenTestCases, undefined);
    assert.equal(safe.practicalTasks[0].automatedTestCommand, undefined);
    assert.equal(safe.practicalTasks[0].automatedTestFiles, undefined);
    assert.equal(safe.theoryQuestions[0].correctAnswer, undefined);
    assert.equal(serialized.includes('secret-input'), false);
    assert.equal(serialized.includes('secret-output'), false);
    assert.equal(serialized.includes('secret test code'), false);
    assert.equal(serialized.includes('the-correct-answer'), false);

    // The learner should still see everything needed to submit correctly.
    assert.equal(safe.practicalTasks[0].submissionContract.hiddenTestCaseCount, 1);
    assert.deepEqual(safe.practicalTasks[0].publicTestCases, [
      { id: 'p1', input: '1', expectedOutput: '2' },
    ]);
  });
});

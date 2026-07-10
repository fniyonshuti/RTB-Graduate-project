import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OBJECTIVE_CHECK_WEIGHTS,
  scoreRepositoryAssessment,
} from '../../src/services/githubService.js';

describe('repository assessment scoring', () => {
  it('uses explicit weights instead of equal-count scoring', () => {
    const result = scoreRepositoryAssessment({
      staticChecks: [
        {
          id: 'backend-api',
          title: 'Backend/API requirement implemented',
          competency: 'backend',
          passed: true,
        },
        {
          id: 'database',
          title: 'Database persistence implemented',
          competency: 'database',
          passed: false,
        },
      ],
      testCases: [
        {
          id: 'dependency-install',
          title: 'Dependencies install successfully',
          competency: 'deployment',
          passed: true,
        },
        {
          id: 'submitted-automated-tests',
          title: 'Graduate-submitted automated tests pass',
          competency: 'testing',
          passed: false,
        },
        {
          id: 'instructor-task-tests',
          title: 'Instructor-defined practical task tests pass',
          competency: 'testing',
          passed: true,
        },
      ],
      eslintResult: {
        available: true,
        success: true,
        errors: 0,
        warnings: 0,
      },
      securityScanResult: {
        success: false,
        high: 1,
        critical: 0,
        secretFindings: [],
      },
      assessorReviewStatus: 'pending',
    });

    assert.equal(result.totalTestCases, 10);
    assert.equal(result.passedTestCases, 7);
    assert.equal(result.totalWeight, 96);
    assert.equal(result.passedWeight, 66);
    assert.equal(result.accuracyScore, 68.75);
    assert.equal(result.gapClassification, 'Moderate Gap');
    assert.equal(result.competencyScores.testing, 75);
    assert.equal(result.competencyScores.deployment, 100);
    assert.equal(result.competencyScores.database, 0);
    assert.equal(
      result.passedRequirements.find((check) => check.id === 'instructor-task-tests')
        ?.weight,
      OBJECTIVE_CHECK_WEIGHTS['instructor-task-tests'],
    );
  });

  it('honors an explicit check weight when a caller provides one', () => {
    const result = scoreRepositoryAssessment({
      staticChecks: [
        {
          id: 'custom-critical-check',
          title: 'Custom critical check',
          competency: 'backend',
          passed: true,
          weight: 40,
        },
      ],
      eslintResult: {
        available: true,
        success: true,
        errors: 0,
        warnings: 0,
      },
      securityScanResult: {
        success: true,
        high: 0,
        critical: 0,
        secretFindings: [],
      },
      assessorReviewStatus: 'approved',
    });

    assert.equal(result.totalWeight, 80);
    assert.equal(result.passedWeight, 66);
    assert.equal(result.accuracyScore, 82.5);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import mongoose from 'mongoose';
import Assessment from '../../src/models/Assessment.js';

describe('assessment evidence schema', () => {
  it('persists repository evidence under evidence.repositorySummary', () => {
    const assessment = new Assessment({
      graduate: new mongoose.Types.ObjectId(),
      competency: new mongoose.Types.ObjectId(),
      evidence: {
        githubRepositoryUrl: 'https://github.com/example/repo',
        repositorySummary: {
          url: 'https://github.com/example/repo',
          owner: 'example',
          repo: 'repo',
          summaryText: 'Repository was reviewed automatically.',
          taskReview: { score: 82 },
        },
      },
    });

    const evidence = assessment.toObject().evidence;

    assert.equal(evidence.repositorySummary.owner, 'example');
    assert.equal(evidence.repositorySummary.taskReview.score, 82);
  });

  it('silently drops unknown evidence keys, so producers must use the exact schema field name', () => {
    const assessment = new Assessment({
      graduate: new mongoose.Types.ObjectId(),
      competency: new mongoose.Types.ObjectId(),
      evidence: {
        repositoryEvidenceSummary: { owner: 'example' },
      },
    });

    assert.equal(assessment.toObject().evidence.repositoryEvidenceSummary, undefined);
  });
});

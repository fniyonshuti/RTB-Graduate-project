import Competency from '../models/Competency.js';
import RepositoryAssessmentResult from '../models/RepositoryAssessmentResult.js';
import { AppError } from '../utils/errors.js';
import { cleanupTempFolder } from '../utils/cleanupTempFolder.js';
import { cloneGithubRepository } from './githubService.js';
import { analyzeRepository } from './repositoryAnalyzerService.js';
import { runRepositoryTests } from './testRunnerService.js';
import { runEslint } from './eslintService.js';
import { runSecurityScan } from './securityScanService.js';
import { scoreRepositoryAssessment } from './competencyScoringService.js';
import { buildRepositoryAssessmentRecommendations } from './recommendationService.js';
import { isLearnerRole, ROLES } from '../constants/roles.js';

function findPracticalTask(competency, practicalTaskId) {
  if (!competency || !practicalTaskId) return null;
  return competency.practicalTasks?.find(
    (task) => String(task._id) === String(practicalTaskId),
  );
}

export async function assessGithubRepository({
  repositoryUrl,
  competencyId,
  practicalTaskId,
  user,
}) {
  let localPath = '';

  try {
    // This path performs objective checks by cloning and executing the repo.
    // Static GitHub review runs elsewhere; this service is the executable proof layer.
    const competency = competencyId
      ? await Competency.findById(competencyId)
      : null;
    const practicalTask = findPracticalTask(competency, practicalTaskId);

    if (competencyId && !competency) {
      throw new AppError('Competency was not found.', 404);
    }

    const cloned = await cloneGithubRepository(repositoryUrl);
    localPath = cloned.localPath;

    // Reduce the competency/practical task to the text the analyzer needs for
    // rule-based requirement detection.
    const task = {
      title: practicalTask?.title || competency?.title || '',
      instructions: practicalTask?.instructions || '',
      deliverables: practicalTask?.deliverables || '',
      description: competency?.description || '',
    };
    const analysis = await analyzeRepository(localPath, task);
    const testResult = await runRepositoryTests(localPath, analysis, practicalTask || {});
    const eslintResult = await runEslint(localPath, analysis);
    const securityScanResult = await runSecurityScan(localPath, analysis);
    // Final scoring combines static requirement checks, executed tests, lint,
    // and security scan evidence into one explainable automatic result.
    const score = scoreRepositoryAssessment({
      staticChecks: analysis.requirementChecks,
      testCases: testResult.testCases,
      eslintResult,
      securityScanResult,
    });
    const draftResult = {
      graduate: user?._id,
      organization: user?.organization?._id || user?.organization,
      competency: competency?._id,
      practicalTaskId: practicalTask?._id,
      repositoryUrl,
      owner: cloned.repository.owner,
      repo: cloned.repository.repo,
      verificationStatus: 'verified',
      executionMode: testResult.executionMode,
      projectType: analysis.projectType,
      detectedTechnologies: analysis.detectedTechnologies,
      totalTestCases: score.totalTestCases,
      passedTestCases: score.passedTestCases,
      totalWeight: score.totalWeight,
      passedWeight: score.passedWeight,
      accuracyScore: score.accuracyScore,
      gapClassification: score.gapClassification,
      competencyScores: score.competencyScores,
      passedRequirements: score.passedRequirements,
      failedRequirements: score.failedRequirements,
      staticChecks: analysis.requirementChecks,
      commandResults: [
        cloned.cloneResult,
        ...testResult.commandResults,
      ],
      eslintResult,
      securityScanResult,
      assessorReviewStatus: 'approved',
      automaticReviewStatus: 'completed',
      assessorValidationRequired: false,
      securityNotes: testResult.securityNotes,
    };

    draftResult.recommendations =
      buildRepositoryAssessmentRecommendations(draftResult);

    return RepositoryAssessmentResult.create(draftResult);
  } catch (error) {
    // Preserve a failed assessment result instead of losing the review attempt.
    // This gives users a concrete reason to fix access/setup and resubmit.
    const failedRequirement = {
      id: 'repository-assessment-engine',
      title: 'Repository assessment engine completed',
      competency: 'testing',
      passed: false,
      evidence: '',
      weight: 10,
      error:
        error.message ||
        'Repository assessment failed before objective checks could be completed.',
    };
    const result = await RepositoryAssessmentResult.create({
      graduate: user?._id,
      organization: user?.organization?._id || user?.organization,
      competency: competencyId,
      practicalTaskId,
      repositoryUrl,
      verificationStatus: 'failed',
      executionMode: 'failed',
      totalTestCases: 1,
      passedTestCases: 0,
      totalWeight: failedRequirement.weight || 10,
      passedWeight: 0,
      accuracyScore: 0,
      gapClassification: 'High Gap',
      competencyScores: {
        frontend: 0,
        backend: 0,
        database: 0,
        authentication: 0,
        testing: 0,
        documentation: 0,
        deployment: 0,
      },
      passedRequirements: [],
      failedRequirements: [failedRequirement],
      staticChecks: [failedRequirement],
      assessorReviewStatus: 'returned',
      automaticReviewStatus: 'failed',
      assessorValidationRequired: false,
      errorMessage: error.message,
      recommendations: [
        'Fix repository access, project setup, dependencies, or automated tests, then run the assessment again.',
      ],
      securityNotes: [
        'The system did not invent an accuracy score because objective repository execution or verification failed.',
      ],
    });

    return result;
  } finally {
    // Cloned submissions may contain untrusted code; always remove the temp copy.
    await cleanupTempFolder(localPath);
  }
}

export function listRepositoryAssessmentResults(user) {
  const query = isLearnerRole(user.role)
    ? { graduate: user._id }
    : user.role === ROLES.ORGANIZATION_ADMIN
      ? { organization: user.organization?._id || user.organization }
      : {};
  return RepositoryAssessmentResult.find(query)
    .populate('graduate', 'name email institution')
    .populate('competency', 'title code category')
    .sort({ createdAt: -1 });
}

export async function getRepositoryAssessmentResult(resultId, user) {
  const query = isLearnerRole(user.role)
    ? { _id: resultId, graduate: user._id }
    : user.role === ROLES.ORGANIZATION_ADMIN
      ? { _id: resultId, organization: user.organization?._id || user.organization }
      : { _id: resultId };
  const result = await RepositoryAssessmentResult.findOne(query)
    .populate('graduate', 'name email institution')
    .populate('competency', 'title code category');

  if (!result) {
    throw new AppError('Repository assessment result was not found.', 404);
  }

  return result;
}

export async function updateRepositoryAssessmentResult(resultId, payload) {
  const allowedUpdates = [
    'recommendations',
    'securityNotes',
  ];
  const updates = {};

  allowedUpdates.forEach((field) => {
    if (payload[field] !== undefined) updates[field] = payload[field];
  });

  const result = await RepositoryAssessmentResult.findByIdAndUpdate(
    resultId,
    updates,
    { new: true, runValidators: true },
  )
    .populate('graduate', 'name email institution')
    .populate('competency', 'title code category');

  if (!result) {
    throw new AppError('Repository assessment result was not found.', 404);
  }

  return result;
}

export async function deleteRepositoryAssessmentResult(resultId, user) {
  const query = isLearnerRole(user.role)
    ? { _id: resultId, graduate: user._id }
    : user.role === ROLES.ORGANIZATION_ADMIN
      ? { _id: resultId, organization: user.organization?._id || user.organization }
      : { _id: resultId };
  const result = await RepositoryAssessmentResult.findOneAndDelete(query);

  if (!result) {
    throw new AppError('Repository assessment result was not found.', 404);
  }

  return result;
}

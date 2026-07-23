import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildManifestTemplate,
  buildSubmissionContract,
  parseRequiredApiRoute,
} from '../../src/services/githubService.js';

describe('parseRequiredApiRoute', () => {
  it('parses a "METHOD /path" string', () => {
    assert.deepEqual(parseRequiredApiRoute('POST /api/register'), {
      method: 'POST',
      path: '/api/register',
      raw: 'POST /api/register',
    });
  });

  it('defaults to GET when no method is given', () => {
    assert.deepEqual(parseRequiredApiRoute('/health'), {
      method: 'GET',
      path: '/health',
      raw: '/health',
    });
  });

  it('adds a leading slash when the path is missing one', () => {
    const parsed = parseRequiredApiRoute('login');
    assert.equal(parsed.path, '/login');
    assert.equal(parsed.method, 'GET');
  });
});

describe('buildManifestTemplate', () => {
  it('builds a stdin_stdout template for the first allowed language', () => {
    const template = buildManifestTemplate({
      allowedLanguages: ['python'],
      executionInterface: 'stdin_stdout',
    });

    assert.equal(template.language, 'python');
    assert.equal(template.inputOutputProtocol, 'stdin_stdout');
    assert.equal(template.mainEntry, 'main.py');
    assert.equal(template.runCommand, 'python main.py');
  });

  it('builds a rest_api template with a startCommand and port instead of a mainEntry', () => {
    const template = buildManifestTemplate({
      allowedLanguages: ['javascript'],
      executionInterface: 'rest_api',
    });

    assert.equal(template.startCommand, 'node main.js');
    assert.equal(template.port, 3000);
    assert.equal(template.mainEntry, undefined);
  });

  it('defaults to javascript when no language is configured', () => {
    const template = buildManifestTemplate({});
    assert.equal(template.language, 'javascript');
  });
});

describe('buildSubmissionContract', () => {
  it('exposes public test cases and required routes, but only a count of hidden tests', () => {
    const contract = buildSubmissionContract({
      allowedLanguages: ['python'],
      executionInterface: 'stdin_stdout',
      publicTestCases: [{ id: 'p1', input: '2 3', expectedOutput: '5', validator: 'exact_text' }],
      hiddenTestCases: [{ id: 'h1', input: 'secret-input', expectedOutput: 'secret-answer' }],
      requiredApiRoutes: ['POST /register'],
    });

    assert.equal(contract.manifestFileName, 'competra.json');
    assert.deepEqual(contract.publicTestCases, [
      { id: 'p1', title: '', input: '2 3', expectedOutput: '5', validator: 'exact_text' },
    ]);
    assert.equal(contract.hiddenTestCaseCount, 1);
    assert.equal(JSON.stringify(contract).includes('secret'), false);
    assert.deepEqual(contract.requiredApiRoutes, [
      { method: 'POST', path: '/register', raw: 'POST /register' },
    ]);
  });
});

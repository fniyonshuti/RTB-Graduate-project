import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAiRecommendationDraft } from '../../src/services/recommendationService.js';
import { verifyGithubRepository } from '../../src/services/githubService.js';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function restoreTestEnvironment() {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
}

test('Gemini integration builds the recommendation request and parses JSON response', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
  process.env.GEMINI_RECOMMENDATION_MODEL = 'gemini-2.5-flash';
  process.env.RESOURCE_SEARCH_URL = 'https://www.google.com/search?q=';
  delete process.env.GEMINI_RECOMMENDATION_API_URL;

  let capturedUrl = '';
  let capturedRequest;
  globalThis.fetch = async (url, options) => {
    capturedUrl = url;
    capturedRequest = options;

    return {
      ok: true,
      async json() {
        return {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      message: 'Moderate Gap: improve repository tests and theory practice.',
                      actionItems: [
                        'Fix the failed hidden repository test.',
                        'Add a regression test for the failed requirement.',
                        'Review the theory topic connected to the gap.',
                      ],
                      resources: [
                        'video: React forms tutorial - React forms state management validation tutorial',
                        'course: Node.js Express REST API course - Node.js Express REST API MongoDB JWT freeCodeCamp course',
                      ],
                      learningResources: [
                        {
                          type: 'video',
                          title: 'React forms and validation tutorial',
                          provider: 'YouTube search',
                          url: '',
                          searchQuery: 'React forms state validation tutorial',
                          skillArea: 'Frontend forms',
                          reason: 'The learner needs to improve visible form behavior and validation.',
                        },
                        {
                          type: 'course',
                          title: 'Node.js Express REST API course',
                          provider: 'freeCodeCamp / YouTube search',
                          url: '',
                          searchQuery: 'Node.js Express REST API MongoDB JWT freeCodeCamp course',
                          skillArea: 'Backend APIs',
                          reason: 'The learner needs more practice implementing and testing API behavior.',
                        },
                      ],
                      priority: 'medium',
                    }),
                  },
                ],
              },
            },
          ],
        };
      },
    };
  };

  try {
    const result = await generateAiRecommendationDraft({
      competencyTitle: 'Web Application Development',
      benchmarkScore: 80,
      finalScore: 62,
      skillGap: 18,
      gapLevel: 'Moderate Gap',
      repositorySummary: 'Hidden expected-output test failed.',
    });

    assert.equal(
      capturedUrl,
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test-gemini-key',
    );
    assert.equal(capturedRequest.method, 'POST');
    assert.equal(capturedRequest.headers['Content-Type'], 'application/json');

    const body = JSON.parse(capturedRequest.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.match(body.contents[0].parts[0].text, /Web Application Development/);
    assert.match(body.contents[0].parts[0].text, /Hidden expected-output test failed/);
    assert.match(body.contents[0].parts[0].text, /url field is required/);
    assert.match(body.contents[0].parts[0].text, /measured strength/);
    assert.match(body.contents[0].parts[0].text, /practical skill evidence is weak/);
    assert.match(body.contents[0].parts[0].text, /without learning resources/);

    assert.equal(result.provider, 'gemini');
    assert.equal(result.model, 'gemini-2.5-flash');
    assert.equal(result.priority, 'medium');
    assert.equal(result.actionItems.length, 3);
    assert.equal(result.learningResources.length, 2);
    assert.equal(result.learningResources[0].type, 'video');
    assert.ok(result.learningResources[0].url.startsWith('https://www.google.com/search')); 
    assert.equal(result.learningResources[1].skillArea, 'Backend APIs');
    assert.ok(result.learningResources[1].url.startsWith('https://www.google.com/search')); 
    assert.match(result.resources[0], /https:\/\/www\.google\.com\/search/);
    assert.match(result.message, /Moderate Gap/);
  } finally {
    restoreTestEnvironment();
  }
});

test('GitHub integration verifies repository using configured API and token headers', async () => {
  process.env.GITHUB_WEB_BASE_URL = 'https://github.com';
  process.env.GITHUB_API_URL = 'https://api.github.com';
  process.env.GITHUB_TOKEN = 'github-test-token';

  let capturedUrl = '';
  let capturedHeaders = {};
  globalThis.fetch = async (url, options) => {
    capturedUrl = url;
    capturedHeaders = options.headers;

    return {
      ok: true,
      async json() {
        return {
          default_branch: 'main',
          private: false,
          description: 'Competra sample repository',
          html_url: 'https://github.com/fniyonshuti/competra-sample',
        };
      },
    };
  };

  try {
    const repository = await verifyGithubRepository(
      'https://github.com/fniyonshuti/competra-sample',
    );

    assert.equal(capturedUrl, 'https://api.github.com/repos/fniyonshuti/competra-sample');
    assert.equal(capturedHeaders.Authorization, 'Bearer github-test-token');
    assert.equal(capturedHeaders.Accept, 'application/vnd.github+json');
    assert.equal(repository.owner, 'fniyonshuti');
    assert.equal(repository.repo, 'competra-sample');
    assert.equal(repository.defaultBranch, 'main');
    assert.equal(repository.description, 'Competra sample repository');
    assert.equal(repository.htmlUrl, 'https://github.com/fniyonshuti/competra-sample');
  } finally {
    restoreTestEnvironment();
  }
});

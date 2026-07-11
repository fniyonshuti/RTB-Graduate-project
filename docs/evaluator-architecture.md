# Competra Repository Evaluator Architecture

## Central limitation

Competra cannot reliably evaluate completely arbitrary source code without a defined execution contract. Language freedom is possible, but every submission must expose standardized observable behavior through a manifest, adapter, starter template, standard input/output protocol, HTTP interface, or another defined contract.

## Recommended architecture

```text
User submission
  -> GitHub clone or ZIP extraction
  -> competra.json manifest validation
  -> language adapter selection
  -> Docker sandbox execution
  -> platform-owned public and hidden tests
  -> deterministic validators
  -> static quality and security checks
  -> weighted scoring
  -> Gemini recommendation explanation
  -> report and notification
```

The backend keeps this evaluator inside `backend/src/services/githubService.js` so GitHub verification, cloning, sandbox execution, repository analysis, scoring, and repository result persistence remain in one feature service.

## Task specification schema

Practical tasks are stored under a competency and may define a machine-readable task contract.

```json
{
  "taskId": "web-profile-api-v1",
  "taskVersion": "1.0.0",
  "title": "Build a Graduate Profile API",
  "description": "Create an API that can create and retrieve graduate profiles.",
  "acceptedSubmissionTypes": ["github_repository"],
  "allowedLanguages": ["javascript", "typescript", "python"],
  "executionInterface": "stdin_stdout",
  "inputSchema": { "type": "string" },
  "outputSchema": { "type": "string" },
  "validationRules": ["Normalize whitespace before comparison"],
  "publicTestCases": [
    {
      "id": "public-1",
      "requirementId": "REQ-CLI-001",
      "title": "Greets a learner",
      "input": "Aline",
      "expectedOutput": "Hello, Aline",
      "validator": "normalized_text",
      "weight": 10
    }
  ],
  "hiddenTestCases": [
    {
      "id": "hidden-1",
      "requirementId": "REQ-EDGE-001",
      "title": "Handles empty input",
      "input": "",
      "expectedOutput": "Hello, Guest",
      "validator": "normalized_text",
      "weight": 20,
      "isHidden": true
    }
  ],
  "edgeCases": ["Empty input", "Names with spaces"],
  "timeLimitMs": 10000,
  "memoryLimitMb": 512,
  "networkPolicy": "install_only",
  "requiredApiRoutes": [],
  "correctnessWeight": 75,
  "codeQualityWeight": 10,
  "performanceWeight": 5,
  "securityWeight": 10,
  "securityRules": ["No hardcoded secrets", "No network access during tests"],
  "partialCreditRules": ["Each hidden test earns its own weight"]
}
```

## Submission manifest schema

Every serious automatic assessment should include `competra.json` at the repository root. Automatic language detection can suggest values, but the manifest is the source of truth.

### JavaScript or TypeScript

```json
{
  "language": "javascript",
  "runtimeVersion": "20",
  "submissionType": "cli",
  "workingDirectory": ".",
  "installCommand": "npm install --ignore-scripts",
  "buildCommand": "npm run build --if-present",
  "testCommand": "npm test -- --runInBand",
  "mainEntry": "src/index.js",
  "runCommand": "node src/index.js",
  "inputOutputProtocol": "stdin_stdout",
  "timeout": 10000,
  "memoryLimitMb": 512,
  "requiredEnvironmentVariables": []
}
```

### Python

```json
{
  "language": "python",
  "runtimeVersion": "3.12",
  "submissionType": "cli",
  "workingDirectory": ".",
  "installCommand": "pip install -r requirements.txt",
  "testCommand": "pytest -q",
  "mainEntry": "main.py",
  "runCommand": "python main.py",
  "inputOutputProtocol": "stdin_stdout",
  "timeout": 10000,
  "memoryLimitMb": 512,
  "requiredEnvironmentVariables": []
}
```

### Java

```json
{
  "language": "java",
  "runtimeVersion": "21",
  "submissionType": "cli",
  "workingDirectory": ".",
  "installCommand": "",
  "buildCommand": "mvn test -DskipTests",
  "testCommand": "mvn test",
  "mainEntry": "src/main/java/App.java",
  "runCommand": "mvn exec:java -Dexec.mainClass=App",
  "inputOutputProtocol": "stdin_stdout",
  "timeout": 10000,
  "memoryLimitMb": 512
}
```

Java is a future adapter example. The current MVP focuses on JavaScript/TypeScript and Python.

### REST API project

```json
{
  "language": "javascript",
  "runtimeVersion": "20",
  "submissionType": "rest_api",
  "workingDirectory": ".",
  "installCommand": "npm install --ignore-scripts",
  "buildCommand": "npm run build --if-present",
  "startCommand": "npm start",
  "testCommand": "npm test",
  "port": 3000,
  "healthCheckPath": "/health",
  "inputOutputProtocol": "rest_api",
  "timeout": 15000,
  "memoryLimitMb": 512,
  "requiredEnvironmentVariables": ["PORT"]
}
```

REST API black-box checks should validate status codes, JSON response schema, authentication, validation errors, and database state. In the current MVP, API behavior can still be tested through instructor-owned test files and commands.

## Language adapter interface

```ts
interface LanguageAdapter {
  validateSubmission(): Promise<ValidationResult>;
  prepareEnvironment(): Promise<PrepareResult>;
  build(): Promise<BuildResult>;
  execute(testCase: TestCase): Promise<ExecutionResult>;
  cleanup(): Promise<void>;
}
```

The MVP implements adapter behavior inside `githubService.js` for JavaScript/TypeScript and Python. Future versions can split adapters if the evaluator grows.

## Secure sandbox service

The capstone implementation uses Docker with these controls:

- Temporary cloned repository workspace.
- Network disabled during tests by default.
- Network allowed only during dependency installation when task policy permits it.
- CPU limit.
- Memory limit.
- Process limit.
- Execution timeout.
- Output truncation.
- Container destruction after every command.
- Hidden tests are not exposed to users.

Future stronger options include Firecracker microVMs, gVisor, Kubernetes jobs, or a dedicated sandbox service.

## Deterministic correctness testing

Functional correctness must be decided by deterministic platform-owned tests, not by AI.

Supported validator types in the MVP:

- `exact_text`
- `normalized_text`
- `json`
- `numeric`

For algorithmic tasks, Competra sends input through standard input and validates standard output. For API and frontend tasks, the recommended future path is Supertest and Playwright-based black-box tests.

## Scoring model

Recommended scoring categories:

| Category | Weight |
| --- | ---: |
| Functional correctness | 60% |
| Edge-case correctness | 15% |
| Code quality | 10% |
| User-written tests | 5% |
| Performance | 5% |
| Security and task compliance | 5% |

A clean-looking submission that fails platform-owned correctness tests must not receive a high score.

## Normalized result shape

```json
{
  "submissionId": "sub_123",
  "status": "completed",
  "language": "python",
  "build": { "success": true, "logs": [] },
  "correctness": { "score": 78, "passed": 14, "failed": 4, "total": 18 },
  "performance": { "executionTimeMs": 340, "memoryMb": 48 },
  "quality": { "score": 82, "issues": [] },
  "security": { "score": 100, "violations": [] },
  "failedRequirements": [],
  "recommendations": []
}
```

Competra stores the implemented version of this evidence in `RepositoryAssessmentResult.evaluatorResult`.

## Failure handling

The evaluator returns clear feedback for:

- Missing `competra.json`.
- Unsupported language.
- Invalid manifest JSON.
- Invalid working directory.
- Dependency installation failure.
- Build failure.
- Startup or execution failure.
- Timeout.
- Wrong output format.
- Missing hidden test proof.
- Docker unavailable.
- Security scan failures.
- Unsupported project type.

Hidden test inputs and expected outputs must not be exposed in learner feedback.

## MVP implementation phases

1. Add `competra.json` manifest support.
2. Add JavaScript/TypeScript and Python adapters.
3. Add stdin/stdout public and hidden test cases.
4. Keep instructor test-file execution for Node/API tasks.
5. Store normalized evaluator evidence.
6. Feed deterministic findings into Gemini for recommendations.
7. Add REST API black-box evaluator with health checks and HTTP validators.
8. Add frontend evaluator using Playwright only where needed.
9. Add Java, Go, C#, and C++ adapters after the MVP is stable.

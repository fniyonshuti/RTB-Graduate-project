import { useState } from "react";
import { api } from "../api/client";
import { ReadMoreText } from "../components/common";
import type { RepositoryAssessmentResult } from "../types";
import { GITHUB_PLACEHOLDER } from "../constants/github";

function getHiddenInstructorTestStatus(result: RepositoryAssessmentResult) {
  const passed = result.passedRequirements.find(
    (item) => item.id === "instructor-task-tests",
  );
  const failed = result.failedRequirements.find(
    (item) => item.id === "instructor-task-tests",
  );

  if (passed) {
    return {
      label: "Passed",
      detail: passed.evidence || "Hidden instructor tests passed.",
    };
  }

  if (failed) {
    const error = failed.error || "Hidden instructor tests did not pass.";
    return {
      label: /not configured/i.test(error) ? "Not configured" : "Failed",
      detail: error,
    };
  }

  return {
    label: "Not available",
    detail:
      "No hidden instructor test result was returned for this repository review.",
  };
}

type Props = {
  token: string;
  competency?: string;
  practicalTaskId?: string;
};

export function RepositoryAssessmentPage({
  token,
  competency,
  practicalTaskId,
}: Props) {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [result, setResult] = useState<RepositoryAssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await api.assessRepository(token, {
        repositoryUrl,
        competency,
        practicalTaskId,
      });
      setResult(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Repository assessment failed",
      );
    } finally {
      setLoading(false);
    }
  }

  const hiddenTestStatus = result
    ? getHiddenInstructorTestStatus(result)
    : null;

  return (
    <section className="repository-assessment-page">
      <form className="form-card" onSubmit={handleSubmit}>
        <h2>Automated GitHub repository assessment</h2>
        <ReadMoreText
          text="Submit a GitHub repository to verify whether the code implements the practical task using static checks, dependency installation, build or test scripts, ESLint, and competency scoring."
          limit={180}
        />
        <label>
          GitHub repository URL
          <input
            value={repositoryUrl}
            onChange={(event) => setRepositoryUrl(event.target.value)}
            placeholder={GITHUB_PLACEHOLDER.ORGANIZATION_REPO}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Assessing repository..." : "Run repository assessment"}
        </button>
      </form>

      {error && <div className="alert error">{error}</div>}

      {result && (
        <article className="repository-result-card">
          <header>
            <div>
              <span>{result.verificationStatus}</span>
              <h3>
                {result.owner}/{result.repo}
              </h3>
            </div>
            <strong>{result.accuracyScore}%</strong>
          </header>

          <div className="result-grid">
            <div>
              <small>Execution mode</small>
              <strong>{result.executionMode}</strong>
            </div>
            <div>
              <small>Gap level</small>
              <strong>{result.gapClassification}</strong>
            </div>
            <div>
              <small>Tests passed</small>
              <strong>
                {result.passedTestCases}/{result.totalTestCases}
              </strong>
            </div>
          </div>

          <section>
            <h4>Detected technologies</h4>
            <ReadMoreText
              text={
                result.detectedTechnologies.length
                  ? result.detectedTechnologies.join(", ")
                  : "No major technology detected."
              }
              limit={180}
            />
          </section>

          <section>
            <h4>Competency scores</h4>
            <div className="result-grid">
              {Object.entries(result.competencyScores).map(([key, value]) => (
                <div key={key}>
                  <small>{key}</small>
                  <strong>{value}%</strong>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4>Repository review pipeline</h4>
            <div className="result-grid">
              <div>
                <small>Hidden expected output test</small>
                <strong>{hiddenTestStatus?.label || "Not available"}</strong>
                <ReadMoreText
                  text={
                    hiddenTestStatus?.detail ||
                    "No hidden instructor test result was returned."
                  }
                  limit={130}
                />
              </div>
              <div>
                <small>Automated tests</small>
                <strong>
                  {result.passedRequirements.some((item) =>
                    [
                      "submitted-automated-tests",
                      "instructor-task-tests",
                    ].includes(item.id || ""),
                  )
                    ? "Passed"
                    : "Needs work"}
                </strong>
              </div>
              <div>
                <small>Docker execution</small>
                <strong>{result.executionMode}</strong>
              </div>
              <div>
                <small>ESLint</small>
                <strong>
                  {result.eslintResult?.success ? "Passed" : "Needs work"}
                </strong>
              </div>
              <div>
                <small>Security scan</small>
                <strong>
                  {result.securityScanResult?.success ? "Passed" : "Needs work"}
                </strong>
              </div>
              <div>
                <small>Automatic validation</small>
                <strong>{result.automaticReviewStatus || "completed"}</strong>
              </div>
            </div>
          </section>

          <section>
            <h4>Passed requirements</h4>
            <ul>
              {result.passedRequirements.map((item) => (
                <li key={item.id}>
                  <ReadMoreText text={item.title} limit={150} />
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4>Failed requirements</h4>
            <ul>
              {result.failedRequirements.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <ReadMoreText text={item.error} limit={160} />
                </li>
              ))}
            </ul>
          </section>

          {result.assessorValidationRequired && (
            <div className="alert warning">
              Some requirements could not be fully proven automatically. Add
              stronger automated tests or implementation evidence before
              resubmission.
            </div>
          )}

          <section>
            <h4>Recommendations</h4>
            <ul>
              {result.recommendations.map((item) => (
                <li key={item}>
                  <ReadMoreText text={item} limit={160} />
                </li>
              ))}
            </ul>
          </section>
        </article>
      )}
    </section>
  );
}

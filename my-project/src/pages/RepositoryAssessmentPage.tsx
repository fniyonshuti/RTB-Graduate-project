import { useState } from 'react'
import { api } from '../api/client'
import type { RepositoryAssessmentResult } from '../types'

type Props = {
  token: string
  competency?: string
  practicalTaskId?: string
}

export function RepositoryAssessmentPage({
  token,
  competency,
  practicalTaskId,
}: Props) {
  const [repositoryUrl, setRepositoryUrl] = useState('')
  const [result, setResult] = useState<RepositoryAssessmentResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await api.assessRepository(token, {
        repositoryUrl,
        competency,
        practicalTaskId,
      })
      setResult(data)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Repository assessment failed',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="repository-assessment-page">
      <form className="form-card" onSubmit={handleSubmit}>
        <h2>Automated GitHub repository assessment</h2>
        <p>
          Submit a GitHub repository to verify whether the code implements the
          practical task using static checks, dependency installation, build or
          test scripts, ESLint, and competency scoring.
        </p>
        <label>
          GitHub repository URL
          <input
            value={repositoryUrl}
            onChange={(event) => setRepositoryUrl(event.target.value)}
            placeholder="https://github.com/owner/repository"
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Assessing repository...' : 'Run repository assessment'}
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
            <p>
              {result.detectedTechnologies.length
                ? result.detectedTechnologies.join(', ')
                : 'No major technology detected.'}
            </p>
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
                <small>Automated tests</small>
                <strong>
                  {result.passedRequirements.some((item) =>
                    ['submitted-automated-tests', 'instructor-task-tests'].includes(
                      item.id || '',
                    ),
                  )
                    ? 'Passed'
                    : 'Needs work'}
                </strong>
              </div>
              <div>
                <small>Docker execution</small>
                <strong>{result.executionMode}</strong>
              </div>
              <div>
                <small>ESLint</small>
                <strong>
                  {result.eslintResult?.success ? 'Passed' : 'Needs work'}
                </strong>
              </div>
              <div>
                <small>Security scan</small>
                <strong>
                  {result.securityScanResult?.success ? 'Passed' : 'Needs work'}
                </strong>
              </div>
              <div>
                <small>Assessor review</small>
                <strong>{result.assessorReviewStatus || 'pending'}</strong>
              </div>
            </div>
          </section>

          <section>
            <h4>Passed requirements</h4>
            <ul>
              {result.passedRequirements.map((item) => (
                <li key={item.id}>{item.title}</li>
              ))}
            </ul>
          </section>

          <section>
            <h4>Failed requirements</h4>
            <ul>
              {result.failedRequirements.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span>{item.error}</span>
                </li>
              ))}
            </ul>
          </section>

          {result.assessorValidationRequired && (
            <div className="alert warning">
              Some requirements could not be fully proven automatically.
              Assessor validation is required.
            </div>
          )}

          <section>
            <h4>Recommendations</h4>
            <ul>
              {result.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </article>
      )}
    </section>
  )
}

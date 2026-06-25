import { useState } from 'react'
import { Alert, Button, Card, SelectField, TextField } from '../components/common'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../types'
import heroImage from '../assets/hero.png'

export function AuthPages() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('graduate')
  const [institution, setInstitution] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register({ name, email, password, role, institution })
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Authentication failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <nav className="auth-navbar" aria-label="Homepage navigation">
        <div className="auth-brand">
          <div className="brand-mark">RTB</div>
          <div>
            <strong>Skills Gap Analysis Tool</strong>
            <span>Kicukiro TVET ICT Graduates</span>
          </div>
        </div>
        <div className="auth-nav-links">
          <a href="#overview">Overview</a>
          <a href="#workflow">Workflow</a>
          <a href="#users">Users</a>
        </div>
        <div className="auth-nav-actions">
          <button
            className={mode === 'login' ? 'active' : ''}
            type="button"
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            className={mode === 'register' ? 'active' : ''}
            type="button"
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>
      </nav>

      <section className="auth-hero">
        <section className="auth-intro">
          <BadgeLine />
          <h1>Evidence-based skills gap analysis for ICT TVET graduates.</h1>
          <p>
            Designed for Kicukiro District, this system helps graduates prove
            practical ICT competencies, helps assessors review evidence using
            rubrics, and compares final scores with RTB occupational standards.
          </p>
          <div className="hero-actions">
            <Button onClick={() => setMode('register')}>Get Started</Button>
            <Button variant="secondary" onClick={() => setMode('login')}>
              Sign In
            </Button>
          </div>
          <div className="assessment-model">
            <span>Practical Task 50%</span>
            <span>Quiz Theory 20%</span>
            <span>Portfolio 20%</span>
            <span>Self Review 10%</span>
          </div>
          <div className="auth-trust-grid" aria-label="System capabilities">
            <div>
              <strong>50-120 graduates</strong>
              <span>Built for realistic pilot evaluation in Kicukiro District.</span>
            </div>
            <div>
              <strong>RTB standards</strong>
              <span>Competencies are mapped to occupational requirements.</span>
            </div>
            <div>
              <strong>Clear reports</strong>
              <span>Graduates see strengths, weaknesses, and next steps.</span>
            </div>
          </div>
        </section>

        <section className="auth-showcase" aria-label="Project assessment overview">
          <img src={heroImage} alt="Digital competency assessment layers" />
          <div className="showcase-panel">
            <span>Graduate Assessment</span>
            <strong>Networking Fundamentals</strong>
            <div className="showcase-progress">
              <div>
                <span>Final score</span>
                <strong>78%</strong>
              </div>
              <div>
                <span>RTB benchmark</span>
                <strong>85%</strong>
              </div>
            </div>
            <div className="showcase-bar" aria-hidden="true">
              <span />
            </div>
            <small>Low Gap - practice router configuration and subnetting tasks.</small>
          </div>
        </section>

        <Card title={mode === 'login' ? 'Sign in to dashboard' : 'Create project account'}>
          <form className="form-stack" onSubmit={handleSubmit}>
            {error && <Alert type="error">{error}</Alert>}
            {mode === 'register' && (
              <>
                <TextField
                  label="Full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
                <SelectField
                  label="Role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                >
                  <option value="graduate">Graduate</option>
                  <option value="assessor">Assessor</option>
                  <option value="admin">Admin</option>
                </SelectField>
                <TextField
                  label="Institution"
                  value={institution}
                  onChange={(event) => setInstitution(event.target.value)}
                />
              </>
            )}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
            </Button>
            <button
              className="link-button"
              type="button"
              onClick={() => {
                setError('')
                setMode(mode === 'login' ? 'register' : 'login')
              }}
            >
              {mode === 'login' ? 'Create a new account' : 'Already have an account? Sign in'}
            </button>
          </form>
        </Card>
      </section>

      <section className="homepage-section" id="overview">
        <div className="section-intro">
          <span className="eyebrow">Why this system matters</span>
          <h2>It closes the gap between training outcomes and workplace expectations.</h2>
          <p>
            The proposal identifies a real challenge: many ICT TVET graduates do
            not clearly know how their skills compare with RTB occupational
            standards. This tool turns assessment evidence into measurable scores,
            gap levels, and improvement recommendations.
          </p>
        </div>
        <div className="homepage-card-grid">
          <article>
            <strong>Practical skills first</strong>
            <p>
              Graduates submit real tasks, project work, quiz answers, portfolio
              links, and supporting files instead of relying only on self-report.
            </p>
          </article>
          <article>
            <strong>Assessor-reviewed evidence</strong>
            <p>
              TVET assessors review submissions with predefined rubrics and add
              competency-specific recommendations.
            </p>
          </article>
          <article>
            <strong>Automated gap analysis</strong>
            <p>
              The system calculates final scores, compares them with RTB
              benchmarks, classifies gap levels, and prepares downloadable reports.
            </p>
          </article>
        </div>
      </section>

      <section className="homepage-section" id="workflow">
        <div className="section-intro">
          <span className="eyebrow">How it works</span>
          <h2>A simple workflow from evidence submission to improvement plan.</h2>
        </div>
        <div className="homepage-workflow">
          <div>
            <span>01</span>
            <strong>Select competency</strong>
            <p>Graduate chooses an ICT competency aligned with RTB standards.</p>
          </div>
          <div>
            <span>02</span>
            <strong>Submit evidence</strong>
            <p>Practical tasks, theory answers, portfolio work, and self-score are submitted.</p>
          </div>
          <div>
            <span>03</span>
            <strong>Assessor review</strong>
            <p>Assessor scores practical, quiz, portfolio, and self-assessment components.</p>
          </div>
          <div>
            <span>04</span>
            <strong>Gap report</strong>
            <p>Graduate receives score, RTB benchmark comparison, gap level, and recommendations.</p>
          </div>
        </div>
      </section>

      <section className="homepage-section" id="users">
        <div className="section-intro">
          <span className="eyebrow">Built for every actor</span>
          <h2>Graduates, assessors, and administrators each get a focused workspace.</h2>
        </div>
        <div className="homepage-user-grid">
          <article>
            <strong>Graduates</strong>
            <span>Take assessments, upload evidence, view gap results, download reports.</span>
          </article>
          <article>
            <strong>Assessors</strong>
            <span>Review submitted evidence, assign rubric scores, provide recommendations.</span>
          </article>
          <article>
            <strong>Administrators</strong>
            <span>Manage users, competencies, RTB benchmarks, notifications, and reports.</span>
          </article>
        </div>
      </section>
    </main>
  )
}

function BadgeLine() {
  return <span className="eyebrow">TVET ICT Graduate Competency Assessment</span>
}

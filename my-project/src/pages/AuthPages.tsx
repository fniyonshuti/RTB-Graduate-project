import { useState } from "react";
import {
  Alert,
  Button,
  SelectField,
  TextField,
} from "../components/common";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";
import heroImage from "../assets/hero.png";

export function AuthPages() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("graduate");
  const [institution, setInstitution] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register({ name, email, password, role, institution });
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Authentication failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="home-header">
        <div className="auth-brand">
          <div className="brand-mark">SG</div>
          <div>
            <strong>Skills Gap</strong>
            <span>RTB-aligned graduate assessment</span>
          </div>
        </div>
        <nav className="home-nav-links" aria-label="Homepage sections">
          <a href="#project-description">Overview</a>
          <a href="#workflow">Workflow</a>
          <a href="#features">System Logic</a>
        </nav>
        <div className="auth-nav-actions">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setShowAuthPanel(true);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setShowAuthPanel(true);
            }}
          >
            Create account
          </button>
        </div>
      </header>

      <section
        className="home-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(9, 23, 38, 0.88) 0%, rgba(9, 23, 38, 0.72) 48%, rgba(9, 23, 38, 0.18) 100%), url(${heroImage})`,
        }}
      >
        <div className="home-hero__content">
          <BadgeLine />
          <h1>Skills Gap Analysis Tool</h1>
          <p>
            A web-based system for ICT TVET graduates in Kicukiro District to
            submit practical evidence, complete theory questions, receive
            assessor-reviewed scores, and compare results with RTB competency
            benchmarks.
          </p>
          <div className="hero-actions">
            <Button
              onClick={() => {
                setMode("register");
                setShowAuthPanel(true);
              }}
            >
              Get started
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setMode("login");
                setShowAuthPanel(true);
              }}
            >
              Sign in
            </Button>
          </div>
        </div>
      </section>

      {showAuthPanel && (
        <section className="auth-panel">
          <div className="auth-window">
            <aside className="auth-window__brand">
              <div className="brand-mark">SG</div>
              <h2>Skills Gap Analysis Tool</h2>
              <p>
                Assess ICT graduate competencies against RTB-aligned standards
                for Kicukiro District.
              </p>
              <div className="auth-window__meta">
                <span>Practical evidence</span>
                <span>Assessor review</span>
                <span>Gap reports</span>
              </div>
            </aside>

            <section className="auth-window__form" aria-label="Account access form">
              <button
                className="auth-window__close"
                type="button"
                onClick={() => setShowAuthPanel(false)}
              >
                Back to homepage
              </button>
              <div className="auth-window__heading">
                <span className="eyebrow">Account access</span>
                <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>
                <p>
                  {mode === "login"
                    ? "Enter your credentials to open your role-based dashboard."
                    : "Create an account as a graduate, assessor, or administrator."}
                </p>
              </div>

              <form className="form-stack auth-form" onSubmit={handleSubmit}>
                {error && <Alert type="error">{error}</Alert>}
                {mode === "register" && (
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
                  placeholder="graduate@skills-gap.local"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <TextField
                  label="Password"
                  placeholder="Enter your password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting
                    ? "Please wait..."
                    : mode === "login"
                      ? "Sign in"
                      : "Create account"}
                </Button>
                <p className="auth-switch">
                  {mode === "login" ? "No account yet?" : "Already have an account?"}
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setMode(mode === "login" ? "register" : "login");
                    }}
                  >
                    {mode === "login" ? "Create account" : "Sign in"}
                  </button>
                </p>
              </form>
            </section>
          </div>
        </section>
      )}

      <section
        className="home-section home-section--light"
        id="project-description"
      >
        <div className="section-intro section-intro--center">
          <span className="eyebrow">About project</span>
          <h2>Built for graduates, TVET institutions, and administrators</h2>
          <p>
            The system supports the full skills gap workflow: graduate profile
            management, competency assessment, practical evidence submission,
            assessor rubric review, RTB benchmark comparison, recommendations,
            reports, notifications, and dashboards.
          </p>
        </div>
        <div className="card-grid card-grid--three">
          <article className="info-card">
            <span className="info-icon">01</span>
            <strong>Graduates</strong>
            <p>
              Register, manage a profile, select competencies, submit practical
              tasks, answer theory questions, upload portfolio evidence, and view
              skill gap results.
            </p>
          </article>
          <article className="info-card">
            <span className="info-icon">02</span>
            <strong>Assessors</strong>
            <p>
              Review submitted evidence, score practical work and portfolio
              artifacts using rubrics, approve quiz/theory results, and provide
              competency-specific recommendations.
            </p>
          </article>
          <article className="info-card">
            <span className="info-icon">03</span>
            <strong>Administrators</strong>
            <p>
              Manage users, ICT competencies, RTB benchmark scores, assessment
              records, reports, notifications, and overall system data.
            </p>
          </article>
        </div>
      </section>

      <section className="home-section home-section--muted" id="workflow">
        <div className="workflow-layout">
          <div className="section-intro">
            <span className="eyebrow">How it works</span>
            <h2>From assessment to evidence-based action</h2>
            <p>
              The system measures real practical ability by combining practical
              tasks, quiz/theory answers, portfolio evidence, and self-assessment
              into a final weighted competency score.
            </p>
          </div>
          <div className="workflow-checklist" aria-label="Workflow steps">
            <div>
              <span />
              Graduate creates an account and completes profile information
            </div>
            <div>
              <span />
              Graduate selects an RTB-aligned ICT competency
            </div>
            <div>
              <span />
              Graduate submits practical task work, theory answers, and portfolio evidence
            </div>
            <div>
              <span />
              Assessor reviews evidence, assigns rubric scores, and adds recommendations
            </div>
            <div>
              <span />
              System calculates skill gap, classifies gap level, notifies users, and generates reports
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-section--cards" id="features">
        <div className="card-grid card-grid--three card-grid--soft">
          <article className="feature-card">
            <strong>Weighted assessment model</strong>
            <p>
              Final score uses Practical Task 50%, Quiz/Theory 20%, Portfolio
              20%, and Self Assessment 10%.
            </p>
          </article>
          <article className="feature-card">
            <strong>RTB benchmark comparison</strong>
            <p>
              Skill Gap = RTB Benchmark Score - Graduate Final Score, then the
              system classifies No, Low, Moderate, or High Gap.
            </p>
          </article>
          <article className="feature-card">
            <strong>Reports and notifications</strong>
            <p>
              Graduates can download reports and receive notifications when
              reviews are completed; assessors are notified after submissions.
            </p>
          </article>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer__brand">
          <div className="brand-mark">SG</div>
          <p>
            Supporting ICT TVET graduate readiness in Kicukiro District through
            practical assessment, RTB benchmark comparison, assessor
            recommendations, notifications, and reports.
          </p>
        </div>
        <div>
          <strong>Access</strong>
          <button
            className="home-footer-link"
            type="button"
            onClick={() => {
              setMode("register");
              setShowAuthPanel(true);
            }}
          >
            Create account
          </button>
          <button
            className="home-footer-link"
            type="button"
            onClick={() => {
              setMode("login");
              setShowAuthPanel(true);
            }}
          >
            Sign in
          </button>
          <span>Role-based dashboard</span>
        </div>
        <div>
          <strong>Users</strong>
          <span>Graduates</span>
          <span>Assessors</span>
          <span>Administrators</span>
        </div>
        <div className="home-footer__bottom">
          <span>Skills Gap Analysis Tool for ICT TVET Graduates in Kicukiro District</span>
          <span>Practical evidence, RTB benchmarks, gap levels, and recommendations</span>
        </div>
      </footer>
    </main>
  );
}

function BadgeLine() {
  return (
    <span className="eyebrow">TVET ICT Graduate Competency Assessment</span>
  );
}

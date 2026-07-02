import { useState } from "react";
import {
  Alert,
  Button,
  TextField,
} from "../components/common";
import { api } from "../api/client";
import { useAuth } from "../context/useAuth";
import heroImage from "../assets/hero.png";

function getInitialAuthState() {
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get("resetToken") || params.get("token") || "";

  return {
    mode: resetToken ? ("reset" as const) : ("login" as const),
    resetToken,
    showAuthPanel: Boolean(resetToken),
  };
}

export function AuthPages() {
  const { login, register } = useAuth();
  const [initialAuthState] = useState(getInitialAuthState);
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(
    initialAuthState.mode,
  );
  const [showAuthPanel, setShowAuthPanel] = useState(
    initialAuthState.showAuthPanel,
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState(initialAuthState.resetToken);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else if (mode === "register") {
        await register({ name, email, password });
      } else if (mode === "forgot") {
        const result = await api.forgotPassword(email);
        if (result.emailStatus === "resend_domain_verification_required") {
          setMessage(
            result.resetLink
              ? `${result.message} For local testing, use this reset link: ${result.resetLink}. To send email to any recipient, verify your domain in Resend and set EMAIL_FROM to that verified domain.`
              : result.emailMessage || result.message,
          );
        } else {
          setMessage(
            result.resetLink
              ? `${result.message} Reset link for testing: ${result.resetLink}`
              : result.message,
          );
        }
      } else {
        await api.resetPassword(resetToken, newPassword);
        setMessage("Password reset successfully. Sign in with your new password.");
        setMode("login");
        setPassword("");
        setNewPassword("");
        window.history.replaceState({}, document.title, window.location.pathname);
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
            <span>RTB-aligned automatic assessment</span>
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
            A web-based system for ICT learners to submit practical evidence,
            complete theory questions, receive instant automated scores, and
            compare results with RTB competency benchmarks.
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
                Assess ICT competencies against RTB-aligned standards with
                automatic repository review.
              </p>
              <div className="auth-window__meta">
                <span>Practical evidence</span>
                <span>Automatic scoring</span>
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
                <h2>
                  {mode === "login"
                    ? "Sign in"
                    : mode === "register"
                      ? "Create account"
                      : mode === "forgot"
                        ? "Forgot password"
                        : "Reset password"}
                </h2>
                <p>
                  {mode === "login"
                    ? "Enter your credentials to open your role-based dashboard."
                    : mode === "register"
                      ? "Create an independent Normal User account. Organization users are created by their Organization Admin."
                      : mode === "forgot"
                        ? "Enter your email to generate a secure expiring password reset link."
                        : "Set a new password using the secure reset token."}
                </p>
              </div>

              <form className="form-stack auth-form" onSubmit={handleSubmit}>
                {error && <Alert type="error">{error}</Alert>}
                {message && <Alert type="success">{message}</Alert>}
                {mode === "register" && (
                  <>
                    <TextField
                      label="Full name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                    <Alert type="info">
                      Public signup creates a Normal User account. Ask your
                      Organization Admin to create an Organization User account
                      if your results must belong to an organization.
                    </Alert>
                  </>
                )}
                {mode !== "reset" && (
                  <TextField
                    label="Email"
                    placeholder="learner@skills-gap.local"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                )}
                {mode === "reset" && (
                  <TextField
                    label="Reset token"
                    value={resetToken}
                    onChange={(event) => setResetToken(event.target.value)}
                    required
                  />
                )}
                {mode !== "forgot" && (
                  <TextField
                    label={mode === "reset" ? "New password" : "Password"}
                    placeholder={mode === "reset" ? "Create a new password" : "Enter your password"}
                    type="password"
                    value={mode === "reset" ? newPassword : password}
                    onChange={(event) =>
                      mode === "reset"
                        ? setNewPassword(event.target.value)
                        : setPassword(event.target.value)
                    }
                    required
                  />
                )}
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting
                    ? "Please wait..."
                    : mode === "login"
                      ? "Sign in"
                      : mode === "register"
                        ? "Create account"
                        : mode === "forgot"
                          ? "Send reset link"
                          : "Reset password"}
                </Button>
                {mode === "login" && (
                  <button
                    className="text-link-button"
                    type="button"
                    onClick={() => {
                      setError("");
                      setMessage("");
                      setMode("forgot");
                    }}
                  >
                    Forgot password?
                  </button>
                )}
                <p className="auth-switch">
                  {mode === "login" ? "No account yet?" : "Already have an account?"}
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setMessage("");
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
          <h2>Built for learners, organizations, and administrators</h2>
          <p>
            The system supports the full skills gap workflow: user profile
            management, competency assessment, practical evidence submission,
            automatic GitHub task review, RTB benchmark comparison,
            recommendations, reports, notifications, and dashboards.
          </p>
        </div>
        <div className="card-grid card-grid--three">
          <article className="info-card">
            <span className="info-icon">01</span>
            <strong>Normal Users</strong>
            <p>
              Register independently, manage a profile, select competencies, submit practical
              GitHub evidence, answer theory questions, and view
              skill gap results.
            </p>
          </article>
          <article className="info-card">
            <span className="info-icon">02</span>
            <strong>Organization Admins</strong>
            <p>
              Manage organization users and view only their organization
              assessment results, skill gaps, reports, and analytics.
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
              GitHub project evidence and quiz/theory answers
              into a final weighted competency score.
            </p>
          </div>
          <div className="workflow-checklist" aria-label="Workflow steps">
            <div>
              <span />
              User creates an account and completes profile information
            </div>
            <div>
              <span />
              User selects an RTB-aligned ICT competency
            </div>
            <div>
              <span />
              User submits GitHub practical evidence and theory answers
            </div>
            <div>
              <span />
              System verifies GitHub task and theory evidence, then generates recommendations
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
              Final score uses Practical/GitHub Project 70% and Quiz/Theory 30%.
            </p>
          </article>
          <article className="feature-card">
            <strong>RTB benchmark comparison</strong>
            <p>
              Skill Gap = RTB Benchmark Score - User Final Score, then the
              system classifies No, Very Low, Low, Moderate, or High Gap.
            </p>
          </article>
          <article className="feature-card">
            <strong>Reports and notifications</strong>
            <p>
              Users can download reports and receive notifications immediately
              after automatic repository analysis completes.
            </p>
          </article>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer__brand">
          <div className="brand-mark">SG</div>
          <p>
            Supporting ICT readiness through practical assessment, RTB benchmark
            comparison, automatic recommendations, notifications, and reports.
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
          <span>Normal Users</span>
          <span>Organization Users</span>
          <span>Organization Admins</span>
          <span>Administrators</span>
        </div>
        <div className="home-footer__bottom">
          <span>Skills Gap Analysis Tool for ICT competency readiness</span>
          <span>Practical evidence, RTB benchmarks, gap levels, and recommendations</span>
        </div>
      </footer>
    </main>
  );
}

function BadgeLine() {
  return (
    <span className="eyebrow">TVET ICT Competency Assessment</span>
  );
}

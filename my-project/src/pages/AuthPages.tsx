import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GitBranch,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Alert, Button, TextField } from "../components/common";
import { api } from "../api/client";
import { useAuth } from "../context/useAuth";

function getInitialAuthState() {
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get("resetToken") || params.get("token") || "";

  return {
    mode: resetToken ? ("reset" as const) : ("login" as const),
    resetToken,
    showAuthPanel: Boolean(resetToken),
  };
}

type AuthMode = "login" | "register" | "forgot" | "reset";

function getAuthContent(mode: AuthMode) {
  const content = {
    login: {
      eyebrow: "Secure sign in",
      title: "Welcome back",
      description:
        "Access your role-based dashboard to continue assessments, review reports, and track ICT competency progress.",
      brandTitle: "Continue your skills journey",
      brandDescription:
        "Sign in to manage practical GitHub evidence, theory answers, gap results, recommendations, and reports in one place.",
      highlights: [
        "Role-based dashboard access",
        "Assessment history and reports",
        "Notifications for reviewed results",
      ],
      actionLabel: "Sign in securely",
    },
    register: {
      eyebrow: "Create public account",
      title: "Start your assessment",
      description:
        "Create  account, complete your profile, select an ICT competency, and submit real practical evidence.",
      brandTitle: "Build an evidence-based profile",
      brandDescription:
        "Public registration is for independent learners. Organization accounts are managed by organization administrators.",
      highlights: [
        "Public learner account",
        "GitHub repository evidence",
        "Benchmark-based gap results",
      ],
      actionLabel: "Create account",
    },
    forgot: {
      eyebrow: "Account recovery",
      title: "Forgot password",
      description:
        "Enter the email linked to your account. The system will generate a secure expiring reset link.",
      brandTitle: "Recover access safely",
      brandDescription:
        "Password recovery protects your account while helping you regain access to assessment records and reports.",
      highlights: [
        "Secure reset token",
        "Expiring password reset link",
        "Return to sign in after reset",
      ],
      actionLabel: "Send reset link",
    },
    reset: {
      eyebrow: "Set new password",
      title: "Reset password",
      description:
        "Use the secure reset token from your email and create a new password for your account.",
      brandTitle: "Create a new password",
      brandDescription:
        "After resetting your password, sign in again to continue using your assessment dashboard.",
      highlights: [
        "Token-based reset",
        "New password required",
        "Immediate sign-in after reset",
      ],
      actionLabel: "Reset password",
    },
  };

  return content[mode];
}

export function AuthPages() {
  const { login, register } = useAuth();
  const [initialAuthState] = useState(getInitialAuthState);
  const [mode, setMode] = useState<AuthMode>(initialAuthState.mode);
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
  const authContent = getAuthContent(mode);

  useEffect(() => {
    const revealItems = Array.from(
      document.querySelectorAll<HTMLElement>(".scroll-reveal"),
    );

    if (!("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.18 },
    );

    revealItems.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

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
        setMessage(
          "Password reset successfully. Sign in with your new password.",
        );
        setMode("login");
        setPassword("");
        setNewPassword("");
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
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
            <span>RTB-aligned ICT assessment</span>
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

      <section className="home-hero">
        <div className="home-hero__content">
          <BadgeLine />
          <h1>Skills Gap Analysis Tool</h1>
          <p>
            A web-based system for ICT learners to submit practical evidence,
            complete theory questions, receive instant automated scores, and
            compare results with RTB competency benchmarks.
          </p>
          <div
            className="hero-proof-strip"
            aria-label="Core public system strengths"
          >
            <span>
              <GitBranch size={18} /> GitHub evidence review
            </span>
            <span>
              <Target size={18} /> RTB benchmark comparison
            </span>
            <span>
              <BellRing size={18} /> Results and notifications
            </span>
          </div>
          <div className="hero-actions">
            <Button
              icon={<ArrowRight size={18} />}
              onClick={() => {
                setMode("register");
                setShowAuthPanel(true);
              }}
            >
              Get started
            </Button>
            <Button
              variant="secondary"
              icon={<LockKeyhole size={18} />}
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
              <span className="auth-window__eyebrow">
                <ShieldCheck size={16} /> Skills Gap Access
              </span>
              <h2>{authContent.brandTitle}</h2>
              <p>{authContent.brandDescription}</p>
              <div className="auth-window__meta">
                {authContent.highlights.map((highlight) => (
                  <span key={highlight}>
                    <CheckCircle2 size={14} /> {highlight}
                  </span>
                ))}
              </div>
            </aside>

            <section
              className="auth-window__form"
              aria-label="Account access form"
            >
              <button
                className="auth-window__close"
                type="button"
                onClick={() => setShowAuthPanel(false)}
              >
                Back to homepage
              </button>
              <div className="auth-window__heading">
                <span className="eyebrow">{authContent.eyebrow}</span>
                <h2>{authContent.title}</h2>
                <p>{authContent.description}</p>
              </div>

              <form className="form-stack auth-form" onSubmit={handleSubmit}>
                {error && <Alert type="error">{error}</Alert>}
                {message && <Alert type="success">{message}</Alert>}
                <div
                  className="auth-mode-card"
                  aria-label="What this account page does"
                >
                  <div className="auth-mode-card__icon">
                    {mode === "login" && <LockKeyhole size={20} />}
                    {mode === "register" && <GraduationCap size={20} />}
                    {mode === "forgot" && <BellRing size={20} />}
                    {mode === "reset" && <ShieldCheck size={20} />}
                  </div>
                  <div>
                    <strong>{authContent.actionLabel}</strong>
                    <span>
                      {mode === "login"
                        ? "Use the email and password created for your role."
                        : mode === "register"
                          ? "After signup, complete your profile before taking an assessment."
                          : mode === "forgot"
                            ? "Check your inbox for the reset link after submitting."
                            : "Choose a strong password, then sign in again."}
                    </span>
                  </div>
                </div>
                {mode === "register" && (
                  <>
                    <TextField
                      autoComplete="name"
                      label="Full name"
                      placeholder="Enter your full name"
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
                    autoComplete="email"
                    label="Email"
                    placeholder="name@example.com"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                )}
                {mode === "reset" && (
                  <TextField
                    autoComplete="one-time-code"
                    label="Reset token"
                    value={resetToken}
                    onChange={(event) => setResetToken(event.target.value)}
                    required
                  />
                )}
                {mode !== "forgot" && (
                  <TextField
                    autoComplete={
                      mode === "reset" ? "new-password" : "current-password"
                    }
                    label={mode === "reset" ? "New password" : "Password"}
                    placeholder={
                      mode === "reset"
                        ? "Create a new password"
                        : "Enter your password"
                    }
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
                <Button
                  disabled={isSubmitting}
                  icon={
                    mode === "login" ? (
                      <LockKeyhole size={18} />
                    ) : (
                      <ArrowRight size={18} />
                    )
                  }
                  type="submit"
                >
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
                  {mode === "login"
                    ? "No account yet?"
                    : mode === "register"
                      ? "Already have an account?"
                      : "Remember your password?"}
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
        className="home-section home-section--light scroll-reveal"
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
            <span className="info-icon">
              <GraduationCap size={19} />
            </span>
            <strong>Normal Users</strong>
            <p>
              Register independently, manage a profile, select competencies,
              submit practical GitHub evidence, answer theory questions, and
              view skill gap results.
            </p>
          </article>
          <article className="info-card">
            <span className="info-icon">
              <Users size={19} />
            </span>
            <strong>Organization Admins</strong>
            <p>
              Manage organization users and view only their organization
              assessment results, skill gaps, reports, and analytics.
            </p>
          </article>
          <article className="info-card">
            <span className="info-icon">
              <ShieldCheck size={19} />
            </span>
            <strong>Administrators</strong>
            <p>
              Manage users, ICT competencies, RTB benchmark scores, assessment
              records, reports, notifications, and overall system data.
            </p>
          </article>
        </div>
      </section>

      <section
        className="home-section home-section--muted scroll-reveal"
        id="workflow"
      >
        <div className="workflow-layout">
          <div className="section-intro">
            <span className="eyebrow">How it works</span>
            <h2>From assessment to evidence-based action</h2>
            <p>
              The system follows an evidence-based workflow from competency
              selection to GitHub repository review, theory scoring, skill gap
              calculation, Gemini recommendations, notifications, and
              generated reports.
            </p>
          </div>
          <div className="workflow-checklist" aria-label="Workflow steps">
            <div>
              <span>
                <Target size={16} />
              </span>
              User selects an RTB-aligned ICT competency
            </div>
            <div>
              <span>
                <GitBranch size={16} />
              </span>
              User submits GitHub practical evidence repository and theory
              answers
            </div>
            <div>
              <span>
                <BadgeCheck size={16} />
              </span>
              System reviews the GitHub repository and scores theory evidence
            </div>
            <div>
              <span>
                <Sparkles size={16} />
              </span>
              System calculates skill gap, classifies gap level, and generates
              recommendations
            </div>
            <div>
              <span>
                <FileText size={16} />
              </span>
              System notifies the user and generates the assessment report
            </div>
          </div>
        </div>
      </section>

      <section
        className="home-section home-section--cards scroll-reveal"
        id="features"
      >
        <div className="card-grid card-grid--three card-grid--soft">
          <article className="feature-card">
            <span className="feature-icon">
              <ClipboardCheck size={20} />
            </span>
            <strong>Weighted assessment model</strong>
            <p>
              Final score uses Practical/GitHub Project 70% and Quiz/Theory 30%.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon">
              <BarChart3 size={20} />
            </span>
            <strong>RTB benchmark comparison</strong>
            <p>
              Skill Gap = RTB Benchmark Score - User Final Score, then the
              system classifies No, Very Low, Low, Moderate, or High Gap.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon">
              <BellRing size={20} />
            </span>
            <strong>Reports and notifications</strong>
            <p>
              Users can download reports and receive notifications immediately
              after automatic repository analysis completes.
            </p>
          </article>
        </div>
      </section>

      <footer className="home-footer scroll-reveal">
        <div className="home-footer__brand">
          <div className="brand">
            <div className="brand-mark">SG</div>
            <div>
              <strong>Skills Gap Analysis Tool</strong>
              <span>Kicukiro TVET ICT readiness</span>
            </div>
          </div>
          <p>
            A professional assessment platform for practical GitHub evidence,
            theory questions, RTB benchmark comparison, recommendations,
            notifications, and downloadable reports.
          </p>
          <div className="home-footer__badges">
            <span>Practical evidence</span>
            <span>RTB benchmark</span>
            <span>Gap report</span>
          </div>
        </div>
        <div className="home-footer__access">
          <strong>Access</strong>
          {/* <p>Start as a learner or return to your role-based dashboard.</p> */}
          <div className="home-footer__actions">
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
          </div>
          {/* <span>Secure access for learners and administrators</span> */}
        </div>
        <div className="home-footer__links">
          <strong>Users</strong>
          <span>Normal Users</span>
          <span>Organization Users</span>
          <span>Organization Admins</span>
          <span>Administrators</span>
        </div>
        <div className="home-footer__links">
          <strong>System</strong>
          <a href="#project-description">Overview</a>
          <a href="#workflow">Assessment workflow</a>
          <a href="#features">System logic</a>
        </div>
        <div className="home-footer__bottom">
          <span>Skills Gap Analysis Tool for ICT competency readiness</span>
          <span>
            Practical evidence, RTB benchmarks, gap levels, and recommendations
          </span>
        </div>
      </footer>
    </main>
  );
}

function BadgeLine() {
  return (
    <span className="eyebrow">
      <CheckCircle2 size={15} /> TVET ICT Competency Assessment
    </span>
  );
}

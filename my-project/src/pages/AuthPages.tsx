import { useCallback, useEffect, useRef, useState } from "react";
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
  Menu,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
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

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="google-icon" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          theme: 'outline' | 'filled_blue' | 'filled_black';
          size: 'large' | 'medium' | 'small';
          type: 'standard' | 'icon';
          text: 'signin_with' | 'signup_with' | 'continue_with';
          shape: 'rectangular' | 'pill' | 'circle' | 'square';
          width?: number;
          locale?: string;
        },
      ) => void;
      cancel: () => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

const GOOGLE_SCRIPT_ELEMENT_ID = 'google-identity-services-script';
const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
const googleIdentityScriptUrl = String(import.meta.env.VITE_GOOGLE_IDENTITY_SCRIPT_URL || '').trim();
let googleIdentityScriptPromise: Promise<void> | null = null;
let googleIdentityInitialized = false;
let latestGoogleCredentialHandler: ((response: GoogleCredentialResponse) => void) | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleIdentityScriptPromise) return googleIdentityScriptPromise;

  googleIdentityScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(
      GOOGLE_SCRIPT_ELEMENT_ID,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Google sign-in script failed to load.')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ELEMENT_ID;
    script.src = googleIdentityScriptUrl;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      googleIdentityScriptPromise = null;
      reject(new Error('Google sign-in script failed to load.'));
    };
    document.head.appendChild(script);
  });

  return googleIdentityScriptPromise;
}
export function AuthPages() {
  const { googleLogin, login, register } = useAuth();
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
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false);
  const authContent = getAuthContent(mode);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const handleGoogleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      setError('');
      setMessage('');

      if (mode === 'register' && !termsAccepted) {
        setError('Please agree to the terms and privacy policy before using Google.');
        return;
      }

      if (!response.credential) {
        setError('Google did not return a sign-in credential. Try again.');
        return;
      }

      setIsSubmitting(true);
      try {
        await googleLogin(response.credential);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Google sign-in failed',
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [googleLogin, mode, termsAccepted],
  );

  useEffect(() => {
    latestGoogleCredentialHandler = handleGoogleCredential;
  }, [handleGoogleCredential]);

  const [googleInitialized, setGoogleInitialized] = useState(googleIdentityInitialized);

  useEffect(() => {
    if (!googleClientId || !googleIdentityScriptUrl) return;

    loadGoogleIdentityScript()
      .then(() => {
        if (!window.google?.accounts?.id) return;

        if (!googleIdentityInitialized) {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: (response) => {
              latestGoogleCredentialHandler?.(response);
            },
          });
          googleIdentityInitialized = true;
        }

        setGoogleInitialized(true);
      })
      .catch((caughtError) => {
        console.error('Failed to load Google Identity Services:', caughtError);
      });
  }, []);

  useEffect(() => {
    if (!showAuthPanel || (mode !== 'login' && mode !== 'register')) return undefined;
    if (!googleClientId || !googleIdentityScriptUrl || !googleInitialized || !googleButtonRef.current) return undefined;

    const buttonHost = googleButtonRef.current;
    buttonHost.innerHTML = '';

    window.google?.accounts?.id.renderButton(buttonHost, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      text: mode === 'register' ? 'signup_with' : 'signin_with',
      shape: 'rectangular',
      width: Math.max(buttonHost.clientWidth, 260),
      locale: 'en',
    });

    return () => {
      buttonHost.innerHTML = '';
    };
  }, [mode, showAuthPanel, googleInitialized, googleClientId]);

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

    if (mode === "register" && !termsAccepted) {
      setError("Please agree to the terms and privacy policy to continue.");
      return;
    }

    if (mode === "reset") {
      if (newPassword.length < 6) {
        setError("New password must be at least 6 characters.");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        setError("New password and confirmation do not match.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else if (mode === "register") {
        await register({ name, email, password });
        setTermsAccepted(false);
      } else if (mode === "forgot") {
        const result = await api.forgotPassword(email);
        setMessage(
          result.resetLink
            ? `${result.message} Reset link for local testing: ${result.resetLink}`
            : result.message,
        );
      } else {
        await api.resetPassword(resetToken, newPassword);
        setMessage(
          "Password reset successfully. Sign in with your new password.",
        );
        setMode("login");
        setPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        window.history.replaceState(
          {},
          document.title,
          "/",
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
          <div className="brand-logo-frame">
            <img src="/competra-icon.png" alt="Competra logo" />
          </div>
          <div>
            <strong>Competra</strong>
            <span>Competency tracking & assessment platform</span>
          </div>
        </div>
        <button
          aria-controls="home-nav-menu"
          aria-expanded={isHomeMenuOpen}
          aria-label="Toggle homepage navigation"
          className="home-menu-button"
          type="button"
          onClick={() => setIsHomeMenuOpen((open) => !open)}
        >
          {isHomeMenuOpen ? <X size={20} /> : <Menu size={20} />}
          <span>Menu</span>
        </button>
        <nav
          className={`home-nav-links ${isHomeMenuOpen ? "is-open" : ""}`}
          id="home-nav-menu"
          aria-label="Homepage sections"
        >
          <a href="#project-description" onClick={() => setIsHomeMenuOpen(false)}>
            Overview
          </a>
          <a href="#workflow" onClick={() => setIsHomeMenuOpen(false)}>
            Workflow
          </a>
          <a href="#features" onClick={() => setIsHomeMenuOpen(false)}>
            System Logic
          </a>
                  <div className="home-mobile-actions">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setShowAuthPanel(true);
                setIsHomeMenuOpen(false);
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setShowAuthPanel(true);
                setIsHomeMenuOpen(false);
              }}
            >
              Create account
            </button>
          </div>
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
          <h1>Competra</h1>
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
              <button
                className="auth-window__back"
                type="button"
                onClick={() => setShowAuthPanel(false)}
              >
                Back to home
              </button>
              <span className="auth-window__eyebrow">
                <ShieldCheck size={16} /> Competra Access
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
                {mode === "reset" && (
                  <TextField
                    autoComplete="new-password"
                    label="Confirm new password"
                    placeholder="Re-enter the new password"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    required
                  />
                )}
                {mode === "register" && (
                  <label className="auth-terms">
                    <input
                      checked={termsAccepted}
                      onChange={(event) =>
                        setTermsAccepted(event.target.checked)
                      }
                      required
                      type="checkbox"
                    />
                    <span>
                      I agree to the{" "}
                      <button type="button">Terms & Conditions</button> and{" "}
                      <button type="button">Privacy Policy</button>.
                    </span>
                  </label>
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
                {(mode === "login" || mode === "register") && (
                  <>
                    <div className="auth-divider">
                      <span>
                        Or {mode === "login" ? "sign in" : "register"} with
                      </span>
                    </div>
                    <div className="auth-social-actions">
                      {googleClientId && googleIdentityScriptUrl ? (
                        <div
                          ref={googleButtonRef}
                          className="auth-google-button-host"
                          aria-label="Continue with Google"
                        />
                      ) : (
                        <button
                          className="auth-social-button"
                          type="button"
                          onClick={() =>
                            setError(
                              "Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_IDENTITY_SCRIPT_URL in the frontend, and GOOGLE_CLIENT_ID in the backend.",
                            )
                          }
                        >
                          <GoogleIcon />
                          Google
                        </button>
                      )}
                    </div>
                  </>
                )}
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
              selection to sandbox GitHub repository testing, theory scoring,
              final score calculation, RTB benchmark comparison, Gemini
              recommendations, notifications, and generated reports.
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
              System securely tests the GitHub repository in an isolated sandbox and scores theory answers
            </div>
            <div>
              <span>
                <Sparkles size={16} />
              </span>
              System calculates the final score, compares it with the RTB
              benchmark, classifies the gap, and generates Gemini recommendations
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
            <div className="brand-logo-frame brand-logo-frame--footer">
              <img src="/competra-icon.png" alt="Competra logo" />
            </div>
            <div>
              <strong>Competra</strong>
              <span>Competency tracking & assessment platform</span>
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
          <span>Competra for ICT competency readiness</span>
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



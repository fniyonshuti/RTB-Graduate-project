import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { ViewKey } from "../components/layout";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  GapBadge,
  LoadingState,
  ProgressBar,
  SelectField,
  StatCard,
  TextArea,
  TextField,
} from "../components/common";
import type {
  Assessment,
  Benchmark,
  Competency,
  DashboardData,
  GraduateProfile,
  NotificationItem,
  Recommendation,
  Report,
  Role,
  User,
} from "../types";
import { formatDate, formatPercent, readableStatus } from "../utils/gapLevels";

type PageProps = {
  token: string;
  role: Role;
};

type DashboardPageProps = PageProps & {
  onNavigate: (view: ViewKey) => void;
};

type AsyncState<T> = {
  data: T;
  isLoading: boolean;
  error: string;
};

function useAsyncData<T>(load: () => Promise<T>, initialData: T) {
  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    isLoading: true,
    error: "",
  });

  const refresh = async () => {
    setState((current) => ({ ...current, isLoading: true, error: "" }));
    try {
      const data = await load();
      setState({ data, isLoading: false, error: "" });
    } catch (caughtError) {
      setState({
        data: initialData,
        isLoading: false,
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load data",
      });
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { ...state, refresh };
}

function dashboardNumber(data: DashboardData, key: string) {
  return typeof data[key] === "number" ? Number(data[key]) : 0;
}

function dashboardText(data: DashboardData, key: string) {
  return typeof data[key] === "string" ? String(data[key]) : "N/A";
}

function dashboardList<T>(data: DashboardData, key: string) {
  return Array.isArray(data[key]) ? (data[key] as T[]) : [];
}

export function DashboardPage({ token, role, onNavigate }: DashboardPageProps) {
  const { data, isLoading, error, refresh } = useAsyncData(
    () => api.dashboard(token),
    {} as DashboardData,
  );

  if (isLoading) return <LoadingState message="Loading dashboard..." />;

  if (role === "graduate") {
    return (
      <GraduateDashboard
        data={data}
        error={error}
        onNavigate={onNavigate}
        onRefresh={refresh}
      />
    );
  }

  const cards =
    role === "assessor"
      ? [
          ["Pending Reviews", dashboardNumber(data, "pendingReviews")],
          [
            "Reviewed Assessments",
            dashboardNumber(data, "reviewedAssessments"),
          ],
          ["High Gap Cases", dashboardNumber(data, "highGapCases")],
          ["Current Role", "Assessor"],
        ]
      : [
          ["Total Graduates", dashboardNumber(data, "totalGraduates")],
          ["Total Assessors", dashboardNumber(data, "totalAssessors")],
          ["Total Competencies", dashboardNumber(data, "totalCompetencies")],
          [
            "Average Skill Gap",
            formatPercent(dashboardNumber(data, "averageSkillGap")),
          ],
        ];

  return (
    <section className="page-stack">
      <PageHeader
        title={`${role.charAt(0).toUpperCase() + role.slice(1)} Dashboard`}
        description="A clear overview of assessment progress, scores, gaps, and action areas."
        onRefresh={refresh}
      />
      {error && <Alert type="error">{error}</Alert>}
      <div className="stat-grid">
        {cards.map(([label, value]) => (
          <StatCard
            helper={
              label === "Average Skill Gap"
                ? dashboardText(data, "overallGapLevel")
                : undefined
            }
            key={label}
            label={String(label)}
            value={value}
          />
        ))}
      </div>
      <Card title="Assessment Engine">
        <div className="engine-strip">
          <span>Evidence submission</span>
          <span>Rubric scoring</span>
          <span>Weighted score</span>
          <span>RTB benchmark</span>
          <span>Gap recommendation</span>
        </div>
      </Card>
    </section>
  );
}

function GraduateDashboard({
  data,
  error,
  onNavigate,
  onRefresh,
}: {
  data: DashboardData;
  error: string;
  onNavigate: (view: ViewKey) => void;
  onRefresh: () => Promise<void>;
}) {
  const recentAssessments = dashboardList<Assessment>(
    data,
    "recentAssessments",
  );
  const latestRecommendations = dashboardList<Recommendation>(
    data,
    "latestRecommendations",
  );
  const overallScore = dashboardNumber(data, "overallScore");
  const averageGap = dashboardNumber(data, "averageGap");
  const competenciesAssessed = dashboardNumber(data, "competenciesAssessed");
  const assessmentsSubmitted = dashboardNumber(data, "assessmentsSubmitted");
  const highGapCount = dashboardNumber(data, "highGapCount");
  const hasReviewedResults = competenciesAssessed > 0;
  const nextAction = hasReviewedResults
    ? "Review improvement plan"
    : "Take first assessment";

  return (
    <section className="page-stack">
      <div className="dashboard-hero">
        <div>
          <span className="eyebrow">Graduate workspace</span>
          <h1>Know your ICT skill gaps and what to improve next.</h1>
          <p>
            Submit practical evidence, wait for assessor review, then compare
            your score with RTB competency benchmarks.
          </p>
        </div>
        <div className="hero-actions">
          <Button onClick={() => onNavigate("submit")}>Take Assessment</Button>
          <Button variant="secondary" onClick={() => onNavigate("results")}>
            View Gap Results
          </Button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="stat-grid">
        <StatCard
          helper={
            hasReviewedResults
              ? "Across reviewed competencies"
              : "No reviewed scores yet"
          }
          label="Overall Score"
          value={formatPercent(overallScore)}
        />
        <StatCard
          helper={dashboardText(data, "overallGapLevel")}
          label="Average Skill Gap"
          value={formatPercent(averageGap)}
        />
        <StatCard
          helper={`${assessmentsSubmitted} submitted`}
          label="Competencies Reviewed"
          value={competenciesAssessed}
        />
        <StatCard
          helper={
            highGapCount > 0 ? "Needs urgent practice" : "No urgent gaps found"
          }
          label="High Gap Areas"
          value={highGapCount}
        />
      </div>

      <div className="dashboard-grid">
        <Card
          actions={
            <Button variant="secondary" onClick={() => void onRefresh()}>
              Refresh
            </Button>
          }
          title="Next best action"
        >
          <div className="next-action">
            <strong>{nextAction}</strong>
            <p>
              {hasReviewedResults
                ? "Open your gap results, focus on moderate and high gap competencies, and follow the assessor recommendations."
                : "Start by selecting one ICT competency and submitting practical work, theory answers, portfolio evidence, and self-assessment."}
            </p>
            <div className="button-row">
              <Button
                onClick={() =>
                  onNavigate(hasReviewedResults ? "results" : "submit")
                }
              >
                Continue
              </Button>
              <Button variant="ghost" onClick={() => onNavigate("profile")}>
                Update Profile
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Assessment workflow">
          <div className="workflow-list">
            <WorkflowStep
              label="1"
              text="Choose a competency aligned with RTB ICT standards."
            />
            <WorkflowStep
              label="2"
              text="Submit practical task details, quiz answers, portfolio evidence, and self-score."
            />
            <WorkflowStep
              label="3"
              text="Assessor reviews evidence using the rubric and records scores."
            />
            <WorkflowStep
              label="4"
              text="System calculates final score, RTB gap level, and recommendations."
            />
          </div>
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card title="Recent assessment activity">
          {recentAssessments.length === 0 ? (
            <EmptyState message="No assessment activity yet. Take an assessment to begin your skills gap profile." />
          ) : (
            <div className="compact-list">
              {recentAssessments.slice(0, 4).map((assessment) => (
                <div className="compact-row" key={assessment._id}>
                  <div>
                    <strong>{assessment.competency.title}</strong>
                    <span>{readableStatus(assessment.status)}</span>
                  </div>
                  <div className="compact-meta">
                    <GapBadge level={assessment.gapLevel} />
                    <span>{formatDate(assessment.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Latest recommendations">
          {latestRecommendations.length === 0 ? (
            <EmptyState message="Recommendations appear here after an assessor reviews your evidence." />
          ) : (
            <div className="compact-list">
              {latestRecommendations.slice(0, 3).map((recommendation) => (
                <div
                  className="recommendation-preview"
                  key={recommendation._id}
                >
                  <div className="compact-meta">
                    <strong>{recommendation.competency.title}</strong>
                    <GapBadge level={recommendation.gapLevel} />
                  </div>
                  <p>{recommendation.message}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="How your final score is calculated">
        <div className="score-weight-grid">
          <WeightBox label="Practical / GitHub project" value="60%" />
          <WeightBox label="Quiz / theory" value="20%" />
          <WeightBox label="Portfolio evidence" value="15%" />
          <WeightBox label="Self-assessment" value="5%" />
        </div>
      </Card>
    </section>
  );
}

function WorkflowStep({ label, text }: { label: string; text: string }) {
  return (
    <div className="workflow-step">
      <span>{label}</span>
      <p>{text}</p>
    </div>
  );
}

function WeightBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="weight-box">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function GraduateProfilePage({ token }: { token: string }) {
  const { data, isLoading, error } = useAsyncData(
    () => api.profile(token),
    null,
  );
  const [profile, setProfile] = useState<GraduateProfile>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (data) setProfile(data);
  }, [data]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const savedProfile = await api.saveProfile(token, profile);
    setProfile(savedProfile);
    setMessage("Profile saved successfully.");
  }

  if (isLoading) return <LoadingState message="Loading profile..." />;

  return (
    <section className="page-stack">
      <PageHeader
        title="Graduate Profile"
        description="Keep academic and contact details ready for assessment reports."
      />
      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}
      <Card title="Profile details">
        <form className="form-grid" onSubmit={handleSubmit}>
          <TextField
            label="Registration number"
            value={profile.registrationNumber || ""}
            onChange={(event) =>
              setProfile({ ...profile, registrationNumber: event.target.value })
            }
          />
          <TextField
            label="Phone"
            value={profile.phone || ""}
            onChange={(event) =>
              setProfile({ ...profile, phone: event.target.value })
            }
          />
          <TextField
            label="District"
            value={profile.district || "Kicukiro"}
            onChange={(event) =>
              setProfile({ ...profile, district: event.target.value })
            }
          />
          <TextField
            label="Sector"
            value={profile.sector || ""}
            onChange={(event) =>
              setProfile({ ...profile, sector: event.target.value })
            }
          />
          <TextField
            label="Institution"
            value={profile.institution || ""}
            onChange={(event) =>
              setProfile({ ...profile, institution: event.target.value })
            }
          />
          <TextField
            label="Program"
            value={profile.program || ""}
            onChange={(event) =>
              setProfile({ ...profile, program: event.target.value })
            }
          />
          <TextField
            label="Graduation year"
            type="number"
            value={profile.graduationYear || ""}
            onChange={(event) =>
              setProfile({
                ...profile,
                graduationYear: Number(event.target.value),
              })
            }
          />
          <TextField
            label="Specialization"
            value={profile.specialization || ""}
            onChange={(event) =>
              setProfile({ ...profile, specialization: event.target.value })
            }
          />
          <div className="full-span">
            <TextArea
              label="Bio"
              rows={4}
              value={profile.bio || ""}
              onChange={(event) =>
                setProfile({ ...profile, bio: event.target.value })
              }
            />
          </div>
          <Button type="submit">Save Profile</Button>
        </form>
      </Card>
    </section>
  );
}

export function SubmitAssessmentPage({ token }: { token: string }) {
  const { data: competencies, isLoading } = useAsyncData(
    () => api.competencies(token),
    [],
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [competency, setCompetency] = useState("");
  const [practicalTaskId, setPracticalTaskId] = useState("");
  const [practicalSubmissionMode, setPracticalSubmissionMode] = useState<
    "direct_test" | "file_upload" | "mixed"
  >("direct_test");
  const [practicalTask, setPracticalTask] = useState("");
  const [githubRepositoryUrl, setGithubRepositoryUrl] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<
    { name: string; type?: string; size?: number; dataUrl: string }[]
  >([]);
  const [theoryAnswers, setTheoryAnswers] = useState<Record<string, string>>(
    {},
  );
  const [portfolioLink, setPortfolioLink] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [selfAssessmentScore, setSelfAssessmentScore] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedCompetency = competencies.find(
    (item) => item._id === competency,
  );
  const availableTasks = selectedCompetency?.practicalTasks || [];
  const selectedTask =
    availableTasks.find((task) => task._id === practicalTaskId) ||
    availableTasks[0];
  const theoryQuestions = selectedCompetency?.theoryQuestions || [];
  const portfolioRequirements = selectedCompetency?.portfolioRequirements || [];
  const answeredTheoryCount = theoryQuestions.filter(
    (question) => (theoryAnswers[question._id] || "").trim().length > 0,
  ).length;
  const requiredTheoryAnswered =
    theoryQuestions.length === 0 ||
    answeredTheoryCount === theoryQuestions.length;
  const evidenceCount = [
    githubRepositoryUrl,
    practicalTask,
    evidenceFiles.length > 0 ? String(evidenceFiles.length) : "",
    answeredTheoryCount > 0 ? String(answeredTheoryCount) : "",
    portfolioLink,
    projectDescription,
  ].filter((value) => value.trim().length > 0).length;
  const canContinueToEvidence = Boolean(competency);
  const practicalEvidenceReady =
    githubRepositoryUrl.trim().length > 0 &&
    (practicalSubmissionMode === "direct_test"
      ? practicalTask.trim().length > 0
      : practicalSubmissionMode === "file_upload"
        ? evidenceFiles.length > 0
        : practicalTask.trim().length > 0 && evidenceFiles.length > 0);
  const canReview =
    practicalEvidenceReady &&
    requiredTheoryAnswered &&
    selfAssessmentScore >= 0;
  const canSubmit =
    Boolean(competency) && practicalEvidenceReady && requiredTheoryAnswered;

  async function handleEvidenceFiles(files: FileList | null) {
    if (!files) return;

    const selectedFiles = Array.from(files);
    const maxSize = 2 * 1024 * 1024;
    const oversized = selectedFiles.find((file) => file.size > maxSize);

    if (oversized) {
      setError(`File "${oversized.name}" is larger than 2MB.`);
      return;
    }

    const encodedFiles = await Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise<{
            name: string;
            type?: string;
            size?: number;
            dataUrl: string;
          }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                dataUrl: String(reader.result),
              });
            reader.onerror = () =>
              reject(new Error(`Failed to read ${file.name}`));
            reader.readAsDataURL(file);
          }),
      ),
    );

    setEvidenceFiles((current) => [...current, ...encodedFiles]);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      await api.submitAssessment(token, {
        competency,
        practicalSubmissionMode,
        practicalTaskId: selectedTask?._id,
        practicalTask,
        githubRepositoryUrl,
        evidenceFiles,
        theoryAnswers: theoryQuestions.map((question) => ({
          questionId: question._id,
          answer: theoryAnswers[question._id] || "",
        })),
        portfolioLink,
        projectDescription,
        selfAssessmentScore,
      });
      setMessage("Assessment evidence submitted for assessor review.");
      setPracticalTask("");
      setGithubRepositoryUrl("");
      setPracticalSubmissionMode("direct_test");
      setEvidenceFiles([]);
      setPracticalTaskId("");
      setTheoryAnswers({});
      setPortfolioLink("");
      setProjectDescription("");
      setSelfAssessmentScore(0);
      setCompetency("");
      setCurrentStep(1);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Submission failed",
      );
    }
  }

  if (isLoading) return <LoadingState message="Loading competencies..." />;

  return (
    <section className="page-stack">
      <PageHeader
        title="Take Competency Assessment"
        description="Complete one competency at a time. Your evidence is reviewed by an assessor before final gap results are calculated."
      />
      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert type="error">{error}</Alert>}
      <div className="assessment-layout">
        <aside className="assessment-side">
          <Card title="Assessment steps">
            <div className="stepper">
              <StepItem
                active={currentStep === 1}
                done={currentStep > 1}
                label="1"
                text="Choose competency"
              />
              <StepItem
                active={currentStep === 2}
                done={currentStep > 2}
                label="2"
                text="Add evidence"
              />
              <StepItem
                active={currentStep === 3}
                done={currentStep > 3}
                label="3"
                text="Self-assess"
              />
              <StepItem
                active={currentStep === 4}
                done={false}
                label="4"
                text="Review & submit"
              />
            </div>
          </Card>

          <Card title="Scoring model">
            <div className="score-weight-list">
              <span>
                <strong>60%</strong> Practical/GitHub project
              </span>
              <span>
                <strong>20%</strong> Quiz / theory
              </span>
              <span>
                <strong>15%</strong> Portfolio evidence
              </span>
              <span>
                <strong>5%</strong> Self-assessment
              </span>
            </div>
          </Card>
        </aside>

        <form className="assessment-panel" onSubmit={handleSubmit}>
          {currentStep === 1 && (
            <Card title="Choose the competency you want assessed">
              <div className="form-stack">
                <SelectField
                  label="Competency"
                  value={competency}
                  onChange={(event) => setCompetency(event.target.value)}
                  required
                >
                  <option value="">Select competency</option>
                  {competencies.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.code} - {item.title}
                    </option>
                  ))}
                </SelectField>

                {selectedCompetency ? (
                  <div className="competency-summary">
                    <div>
                      <span>{selectedCompetency.code}</span>
                      <strong>{selectedCompetency.title}</strong>
                      <p>
                        {selectedCompetency.description ||
                          "No description provided."}
                      </p>
                    </div>
                    <div>
                      <span>Assessment package</span>
                      <p>
                        {availableTasks.length} practical task(s),{" "}
                        {theoryQuestions.length} theory question(s), and{" "}
                        {portfolioRequirements.length} portfolio requirement(s).
                      </p>
                    </div>
                  </div>
                ) : (
                  <EmptyState message="Select a competency to see the expected evidence and start your assessment." />
                )}

                <div className="button-row">
                  <Button
                    disabled={!canContinueToEvidence}
                    onClick={() => setCurrentStep(2)}
                  >
                    Continue to Evidence
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {currentStep === 2 && (
            <Card title="Complete the practical test and theory questions">
              <div className="form-stack">
                <Alert type="info">
                  This is a real assessment submission. You can take the
                  practical test directly in the system, submit a GitHub
                  repository URL, upload completed work, or submit both.
                </Alert>

                {availableTasks.length > 0 ? (
                  <SelectField
                    label="Practical task"
                    value={selectedTask?._id || ""}
                    onChange={(event) => setPracticalTaskId(event.target.value)}
                  >
                    {availableTasks.map((task) => (
                      <option key={task._id} value={task._id}>
                        {task.title}
                      </option>
                    ))}
                  </SelectField>
                ) : (
                  <Alert type="error">
                    This competency does not yet have a practical test
                    configured by the administrator.
                  </Alert>
                )}

                {selectedTask && (
                  <div className="real-test-card">
                    <div className="compact-meta">
                      <strong>{selectedTask.title}</strong>
                      <span>{selectedTask.estimatedMinutes || 60} minutes</span>
                    </div>
                    <p>{selectedTask.instructions}</p>
                    {selectedTask.deliverables && (
                      <div>
                        <strong>Required deliverables</strong>
                        <p>{selectedTask.deliverables}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="submission-mode-grid">
                  <button
                    className={
                      practicalSubmissionMode === "direct_test" ? "active" : ""
                    }
                    onClick={() => setPracticalSubmissionMode("direct_test")}
                    type="button"
                  >
                    Take test here
                    <span>Write the solution directly in the system.</span>
                  </button>
                  <button
                    className={
                      practicalSubmissionMode === "file_upload" ? "active" : ""
                    }
                    onClick={() => setPracticalSubmissionMode("file_upload")}
                    type="button"
                  >
                    Upload evidence
                    <span>
                      Attach screenshots, code, PDFs, or exported work.
                    </span>
                  </button>
                  <button
                    className={
                      practicalSubmissionMode === "mixed" ? "active" : ""
                    }
                    onClick={() => setPracticalSubmissionMode("mixed")}
                    type="button"
                  >
                    Use both
                    <span>Write a summary and attach proof.</span>
                  </button>
                </div>

                {practicalSubmissionMode !== "file_upload" && (
                  <TextArea
                    label="Practical task answer / work summary"
                    rows={6}
                    value={practicalTask}
                    onChange={(event) => setPracticalTask(event.target.value)}
                    placeholder="Explain exactly what you completed, commands used, files created, test results, or deployment link."
                  />
                )}

                <TextField
                  label="GitHub repository URL"
                  type="url"
                  value={githubRepositoryUrl}
                  onChange={(event) =>
                    setGithubRepositoryUrl(event.target.value)
                  }
                  placeholder="https://github.com/username/project"
                  required
                />

                {practicalSubmissionMode !== "direct_test" && (
                  <div className="upload-panel">
                    <label className="file-drop">
                      <span>Upload practical evidence files</span>
                      <input
                        multiple
                        onChange={(event) =>
                          void handleEvidenceFiles(event.target.files)
                        }
                        type="file"
                      />
                    </label>
                    <small>
                      Accepted evidence: screenshots, PDF documents, source
                      files, exported reports, or images. Maximum 2MB per file.
                    </small>
                    {evidenceFiles.length > 0 && (
                      <div className="uploaded-file-list">
                        {evidenceFiles.map((file) => (
                          <div
                            className="uploaded-file"
                            key={`${file.name}-${file.size}`}
                          >
                            <div>
                              <strong>{file.name}</strong>
                              <span>
                                {Math.round((file.size || 0) / 1024)} KB
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              onClick={() =>
                                setEvidenceFiles((current) =>
                                  current.filter(
                                    (item) => item.dataUrl !== file.dataUrl,
                                  ),
                                )
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="question-list">
                  <div className="section-heading">
                    <strong>Theory questions</strong>
                    <span>
                      {answeredTheoryCount}/{theoryQuestions.length} answered
                    </span>
                  </div>
                  {theoryQuestions.length === 0 ? (
                    <EmptyState message="No theory questions configured for this competency yet." />
                  ) : (
                    theoryQuestions.map((question, index) => (
                      <div className="question-card" key={question._id}>
                        <div className="compact-meta">
                          <strong>
                            Question {index + 1} ({question.points} point
                            {question.points === 1 ? "" : "s"})
                          </strong>
                          <span>{question.type.replace("_", " ")}</span>
                        </div>
                        <p>{question.question}</p>
                        {question.type === "multiple_choice" &&
                        question.options?.length ? (
                          <div className="option-list">
                            {question.options.map((option) => (
                              <label key={option}>
                                <input
                                  checked={
                                    theoryAnswers[question._id] === option
                                  }
                                  name={question._id}
                                  onChange={() =>
                                    setTheoryAnswers({
                                      ...theoryAnswers,
                                      [question._id]: option,
                                    })
                                  }
                                  type="radio"
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <TextArea
                            label="Your answer"
                            rows={3}
                            value={theoryAnswers[question._id] || ""}
                            onChange={(event) =>
                              setTheoryAnswers({
                                ...theoryAnswers,
                                [question._id]: event.target.value,
                              })
                            }
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>

                <TextField
                  label="Portfolio or project link"
                  value={portfolioLink}
                  onChange={(event) => setPortfolioLink(event.target.value)}
                  placeholder="https://github.com/username/project or portfolio URL"
                />
                {portfolioRequirements.length > 0 && (
                  <div className="requirement-list">
                    <div className="section-heading">
                      <strong>Portfolio requirements</strong>
                      <span>Assessor will verify these</span>
                    </div>
                    {portfolioRequirements.map((requirement) => (
                      <div className="requirement-item" key={requirement._id}>
                        <strong>
                          {requirement.title}
                          {requirement.required ? " (required)" : ""}
                        </strong>
                        <p>{requirement.description}</p>
                      </div>
                    ))}
                  </div>
                )}
                <TextArea
                  label="Project description"
                  rows={4}
                  value={projectDescription}
                  onChange={(event) =>
                    setProjectDescription(event.target.value)
                  }
                  placeholder="Explain the project goal, tools used, your role, and the final outcome."
                />
                <div className="evidence-readiness">
                  <strong>
                    {Math.min(evidenceCount, 6)}/6 evidence sections completed
                  </strong>
                  <ProgressBar value={Math.min(evidenceCount, 6) * (100 / 6)} />
                </div>
                <div className="button-row">
                  <Button variant="secondary" onClick={() => setCurrentStep(1)}>
                    Back
                  </Button>
                  <Button
                    disabled={!canReview}
                    onClick={() => setCurrentStep(3)}
                  >
                    Continue to Self-Assessment
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {currentStep === 3 && (
            <Card title="Self-assessment">
              <div className="form-stack">
                <Alert type="info">
                  Be honest. This score has the smallest weight, but it helps
                  the assessor understand your confidence level.
                </Alert>
                <TextField
                  label="Self-assessment score"
                  max={100}
                  min={0}
                  type="number"
                  value={selfAssessmentScore}
                  onChange={(event) =>
                    setSelfAssessmentScore(Number(event.target.value))
                  }
                />
                <div className="self-score-preview">
                  <ProgressBar value={selfAssessmentScore} />
                  <span>{formatPercent(selfAssessmentScore)}</span>
                </div>
                <div className="button-row">
                  <Button variant="secondary" onClick={() => setCurrentStep(2)}>
                    Back
                  </Button>
                  <Button onClick={() => setCurrentStep(4)}>
                    Review Submission
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {currentStep === 4 && (
            <Card title="Review before submission">
              <div className="review-summary">
                <ReviewLine
                  label="Competency"
                  value={selectedCompetency?.title || "Not selected"}
                />
                <ReviewLine
                  label="Practical test"
                  value={selectedTask?.title || "No test selected"}
                />
                <ReviewLine
                  label="Submission mode"
                  value={practicalSubmissionMode.replace("_", " ")}
                />
                <ReviewLine
                  label="Practical answer"
                  value={practicalTask || "Not provided"}
                />
                <ReviewLine
                  label="GitHub repository"
                  value={githubRepositoryUrl || "Not provided"}
                />
                <ReviewLine
                  label="Uploaded evidence"
                  value={
                    evidenceFiles.length > 0
                      ? evidenceFiles.map((file) => file.name).join(", ")
                      : "No files uploaded"
                  }
                />
                <ReviewLine
                  label="Theory answers"
                  value={`${answeredTheoryCount}/${theoryQuestions.length} answered`}
                />
                <ReviewLine
                  label="Portfolio link"
                  value={portfolioLink || "Not provided"}
                />
                <ReviewLine
                  label="Project description"
                  value={projectDescription || "Not provided"}
                />
                <ReviewLine
                  label="Self-assessment"
                  value={formatPercent(selfAssessmentScore)}
                />
              </div>
              <div className="button-row">
                <Button variant="secondary" onClick={() => setCurrentStep(3)}>
                  Back
                </Button>
                <Button disabled={!canSubmit} type="submit">
                  Submit for Review
                </Button>
              </div>
            </Card>
          )}
        </form>
      </div>
    </section>
  );
}

function StepItem({
  active,
  done,
  label,
  text,
}: {
  active: boolean;
  done: boolean;
  label: string;
  text: string;
}) {
  return (
    <div
      className={`step-item ${active ? "active" : ""} ${done ? "done" : ""}`}
    >
      <span>{done ? "Done" : label}</span>
      <strong>{text}</strong>
    </div>
  );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="review-line">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

export function AssessmentsPage({ token, role }: PageProps) {
  const { data, isLoading, error, refresh } = useAsyncData(
    () => api.assessments(token),
    [] as Assessment[],
  );
  const [selected, setSelected] = useState<Assessment | null>(null);

  if (isLoading) return <LoadingState message="Loading assessments..." />;

  const submittedCount = data.filter(
    (item) => item.status === "submitted",
  ).length;
  const reviewedCount = data.filter(
    (item) => item.status === "reviewed",
  ).length;
  const returnedCount = data.filter(
    (item) => item.status === "returned",
  ).length;

  return (
    <section className="page-stack">
      <PageHeader
        title={
          role === "assessor"
            ? "Assessment Reviews"
            : role === "admin"
              ? "All Assessments"
              : "My Assessments"
        }
        description="Track submitted evidence, review status, final scores, and gap levels."
        onRefresh={refresh}
      />
      {error && <Alert type="error">{error}</Alert>}
      <div className="status-summary-grid">
        <StatCard
          helper="Waiting for assessor review"
          label="Submitted"
          value={submittedCount}
        />
        <StatCard
          helper="Gap result available"
          label="Reviewed"
          value={reviewedCount}
        />
        <StatCard
          helper="Needs correction or extra evidence"
          label="Returned"
          value={returnedCount}
        />
      </div>
      <Card title="Assessment list">
        {data.length === 0 ? (
          <EmptyState message="No assessments found." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Competency</th>
                  <th>Graduate</th>
                  <th>Status</th>
                  <th>Final Score</th>
                  <th>Gap</th>
                  <th>Submitted</th>
                  {role === "assessor" && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((assessment) => (
                  <tr key={assessment._id}>
                    <td>{assessment.competency.title}</td>
                    <td>{assessment.graduate.name}</td>
                    <td>{readableStatus(assessment.status)}</td>
                    <td>{formatPercent(assessment.scores.finalScore)}</td>
                    <td>
                      <GapBadge level={assessment.gapLevel} />
                    </td>
                    <td>{formatDate(assessment.createdAt)}</td>
                    {role === "assessor" && (
                      <td>
                        <Button
                          variant="secondary"
                          onClick={() => setSelected(assessment)}
                        >
                          Review
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {role === "assessor" && selected && (
        <ReviewAssessmentPanel
          assessment={selected}
          onReviewed={() => {
            setSelected(null);
            void refresh();
          }}
          token={token}
        />
      )}
    </section>
  );
}

function ReviewAssessmentPanel({
  assessment,
  token,
  onReviewed,
}: {
  assessment: Assessment;
  token: string;
  onReviewed: () => void;
}) {
  const rubricCriteria = assessment.competency.rubricCriteria || [];
  const theoryAnswers = assessment.evidence.theoryAnswers || [];
  const [rubricScores, setRubricScores] = useState(() =>
    rubricCriteria.map((criterion) => ({
      criterionId: criterion._id,
      name: criterion.name,
      score: 0,
      comment: "",
    })),
  );
  const [practicalTaskScore, setPracticalTaskScore] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [portfolioScore, setPortfolioScore] = useState(0);
  const [selfAssessmentScore, setSelfAssessmentScore] = useState(
    assessment.evidence.selfAssessmentScore || 0,
  );
  const [assessorComment, setAssessorComment] = useState("");
  const [message, setMessage] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [error, setError] = useState("");
  const [evidenceVerification, setEvidenceVerification] = useState({
    githubReviewed: false,
    practicalEvidenceReviewed: false,
    portfolioReviewed: false,
    theoryReviewed: false,
    authenticityNotes: "",
  });
  const [draftStatus, setDraftStatus] = useState(
    "Loading Gemini draft recommendation...",
  );

  useEffect(() => {
    setQuizScore(assessment.scores.quizScore || 0);
  }, [assessment.scores.quizScore]);

  useEffect(() => {
    setRubricScores(
      rubricCriteria.map((criterion) => ({
        criterionId: criterion._id,
        name: criterion.name,
        score:
          assessment.scores.rubricScores?.find(
            (score) => score.criterionId === criterion._id,
          )?.score || 0,
        comment:
          assessment.scores.rubricScores?.find(
            (score) => score.criterionId === criterion._id,
          )?.comment || "",
      })),
    );
  }, [assessment.scores.rubricScores, rubricCriteria]);

  const rubricPracticalScore = useMemo(() => {
    if (rubricCriteria.length === 0) return practicalTaskScore;

    const totalWeight = rubricCriteria.reduce(
      (sum, criterion) => sum + (Number(criterion.weight) || 0),
      0,
    );

    if (totalWeight === 0) return practicalTaskScore;

    const weightedScore = rubricCriteria.reduce((sum, criterion) => {
      const item = rubricScores.find(
        (score) => score.criterionId === criterion._id,
      );
      return sum + (Number(item?.score) || 0) * (Number(criterion.weight) || 0);
    }, 0);

    return Math.round((weightedScore / totalWeight) * 100) / 100;
  }, [practicalTaskScore, rubricCriteria, rubricScores]);

  const effectivePracticalScore =
    rubricCriteria.length > 0 ? rubricPracticalScore : practicalTaskScore;

  const previewScore = useMemo(
    () =>
      effectivePracticalScore * 0.6 +
      quizScore * 0.2 +
      portfolioScore * 0.15 +
      selfAssessmentScore * 0.05,
    [effectivePracticalScore, portfolioScore, quizScore, selfAssessmentScore],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDraft() {
      try {
        const draft = await api.previewAssessmentRecommendation(
          token,
          assessment._id,
          {
            rubricScores,
            practicalTaskScore: effectivePracticalScore,
            quizScore,
            portfolioScore,
            selfAssessmentScore,
            assessorComment,
            evidenceVerification,
          },
        );

        if (cancelled) return;

        setMessage(draft.recommendation.message);
        setActionItems(draft.recommendation.actionItems.join("\n"));
        setDraftStatus(
          `${draft.recommendation.provider} draft loaded from ${draft.recommendation.model}`,
        );
      } catch (caughtError) {
        if (!cancelled) {
          setDraftStatus(
            caughtError instanceof Error
              ? caughtError.message
              : "AI draft unavailable, using manual recommendation editing.",
          );
        }
      }
    }

    void loadDraft();

    return () => {
      cancelled = true;
    };
  }, [
    assessment._id,
    assessorComment,
    effectivePracticalScore,
    evidenceVerification,
    portfolioScore,
    quizScore,
    rubricScores,
    selfAssessmentScore,
    token,
  ]);

  async function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      await api.reviewAssessment(token, assessment._id, {
        rubricScores,
        practicalTaskScore: effectivePracticalScore,
        quizScore,
        portfolioScore,
        selfAssessmentScore,
        assessorComment,
        evidenceVerification,
        recommendation: {
          message,
          actionItems: actionItems
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        },
      });
      onReviewed();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Review failed",
      );
    }
  }

  return (
    <Card title={`Review ${assessment.competency.title}`}>
      <div className="review-grid">
        <div className="evidence-box">
          <h3>Submitted Evidence</h3>
          <div className="assessor-evidence-section">
            <strong>Assigned practical test</strong>
            <p>
              {assessment.evidence.practicalTaskTitle ||
                assessment.competency.title}
            </p>
            <small>
              {assessment.evidence.practicalTaskInstructions ||
                "No stored practical instructions available."}
            </small>
          </div>
          <div className="assessor-evidence-section">
            <strong>Graduate practical submission</strong>
            <p>
              {assessment.evidence.practicalTask ||
                "No practical task details provided."}
            </p>
          </div>
          <div className="assessor-evidence-section">
            <strong>GitHub repository / practical project</strong>
            {assessment.evidence.githubRepositoryUrl ? (
              <>
                <a
                  href={assessment.evidence.githubRepositoryUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open GitHub repository
                </a>
                {assessment.evidence.repositorySummary?.summaryText && (
                  <p>{assessment.evidence.repositorySummary.summaryText}</p>
                )}
                {assessment.evidence.repositorySummary?.languages?.length ? (
                  <div className="compact-meta">
                    {assessment.evidence.repositorySummary.languages.map(
                      (language) => (
                        <span key={language}>{language}</span>
                      ),
                    )}
                  </div>
                ) : null}
                {assessment.evidence.repositorySummary?.codeQualityNotes
                  ?.length ? (
                  <ul>
                    {assessment.evidence.repositorySummary.codeQualityNotes.map(
                      (note) => (
                        <li key={note}>{note}</li>
                      ),
                    )}
                  </ul>
                ) : null}
                <div className="quality-grid">
                  <StatCard
                    helper="Automatic signal from README, source files, commits, config, and tests."
                    label="Repository Quality"
                    value={formatPercent(
                      assessment.evidence.repositorySummary?.codeQualityScore ||
                        0,
                    )}
                  />
                  <StatCard
                    helper="Automatic signal showing how complete the project evidence is."
                    label="Evidence Completeness"
                    value={formatPercent(
                      assessment.evidence.repositorySummary
                        ?.evidenceCompletenessScore || 0,
                    )}
                  />
                </div>
                {assessment.evidence.repositorySummary?.riskFlags?.length ? (
                  <div className="assessor-note warning-note">
                    <strong>Evidence risk flags</strong>
                    <ul>
                      {assessment.evidence.repositorySummary.riskFlags.map(
                        (flag) => (
                          <li key={flag}>{flag}</li>
                        ),
                      )}
                    </ul>
                  </div>
                ) : null}
                {assessment.evidence.repositorySummary?.readmeExcerpt && (
                  <div className="assessor-note">
                    <strong>README excerpt</strong>
                    <p>{assessment.evidence.repositorySummary.readmeExcerpt}</p>
                  </div>
                )}
                {assessment.evidence.repositorySummary?.sampledSourceFiles
                  ?.length ? (
                  <div className="theory-review-list">
                    {assessment.evidence.repositorySummary.sampledSourceFiles.map(
                      (file) => (
                        <div className="theory-review-item" key={file.path}>
                          <strong>{file.path}</strong>
                          <span>{file.language}</span>
                          <p>{file.excerpt || "No excerpt available."}</p>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <p>No GitHub repository URL provided.</p>
            )}
          </div>
          <div className="assessor-evidence-section">
            <strong>Submission mode</strong>
            <p>
              {(
                assessment.evidence.practicalSubmissionMode || "direct_test"
              ).replace("_", " ")}
            </p>
          </div>
          <div className="assessor-evidence-section">
            <strong>Uploaded practical evidence</strong>
            {assessment.evidence.evidenceFiles?.length ? (
              <div className="uploaded-file-list">
                {assessment.evidence.evidenceFiles.map((file) => (
                  <a
                    className="uploaded-file review-file"
                    download={file.name}
                    href={file.dataUrl}
                    key={`${file.name}-${file.size}`}
                    target="_blank"
                  >
                    <div>
                      <strong>{file.name}</strong>
                      <span>{Math.round((file.size || 0) / 1024)} KB</span>
                    </div>
                    <span>Open</span>
                  </a>
                ))}
              </div>
            ) : (
              <p>No files uploaded.</p>
            )}
          </div>
          <div className="assessor-evidence-section">
            <strong>Project / portfolio description</strong>
            <p>
              {assessment.evidence.projectDescription ||
                "No project description provided."}
            </p>
          </div>
          {assessment.evidence.portfolioLink && (
            <a href={assessment.evidence.portfolioLink} target="_blank">
              Open portfolio evidence
            </a>
          )}
          <div className="assessor-evidence-section">
            <strong>Theory answers</strong>
            {theoryAnswers.length === 0 ? (
              <p>No structured theory answers submitted.</p>
            ) : (
              <div className="theory-review-list">
                {theoryAnswers.map((answer) => (
                  <div className="theory-review-item" key={answer.questionId}>
                    <p>{answer.question}</p>
                    <span>Answer: {answer.answer || "No answer"}</span>
                    <span>
                      Auto score: {answer.pointsAwarded}/{answer.pointsPossible}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {rubricCriteria.length > 0 && (
            <div className="assessor-evidence-section">
              <strong>Rubric criteria</strong>
              <div className="rubric-list">
                {rubricCriteria.map((criterion) => (
                  <div className="rubric-item" key={criterion._id}>
                    <div className="compact-meta">
                      <strong>{criterion.name}</strong>
                      <span>{criterion.weight}%</span>
                    </div>
                    <p>{criterion.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <form className="form-stack" onSubmit={handleReview}>
          {error && <Alert type="error">{error}</Alert>}
          <Alert type="info">{draftStatus}</Alert>
          {rubricCriteria.length > 0 ? (
            <div className="assessor-evidence-section">
              <strong>RTB-aligned rubric scoring</strong>
              <p>
                Score each criterion from 0 to 100. The practical/GitHub score
                is calculated from the rubric weights.
              </p>
              <div className="rubric-score-list">
                {rubricCriteria.map((criterion) => {
                  const current = rubricScores.find(
                    (score) => score.criterionId === criterion._id,
                  );

                  return (
                    <div className="rubric-score-card" key={criterion._id}>
                      <div className="compact-meta">
                        <strong>{criterion.name}</strong>
                        <span>{criterion.weight}% weight</span>
                      </div>
                      <p>{criterion.description}</p>
                      <TextField
                        label="Criterion score"
                        max={100}
                        min={0}
                        type="number"
                        value={current?.score || 0}
                        onChange={(event) =>
                          setRubricScores((items) =>
                            items.map((item) =>
                              item.criterionId === criterion._id
                                ? {
                                    ...item,
                                    score: Number(event.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                      <TextArea
                        label="Criterion comment"
                        rows={2}
                        value={current?.comment || ""}
                        onChange={(event) =>
                          setRubricScores((items) =>
                            items.map((item) =>
                              item.criterionId === criterion._id
                                ? { ...item, comment: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <StatCard
                helper="Calculated from the rubric criteria and used as the practical/GitHub score."
                label="Rubric Practical Score"
                value={formatPercent(rubricPracticalScore)}
              />
            </div>
          ) : null}
          <div className="form-grid">
            {rubricCriteria.length === 0 ? (
              <TextField
                label="Practical task score"
                max={100}
                min={0}
                type="number"
                value={practicalTaskScore}
                onChange={(event) =>
                  setPracticalTaskScore(Number(event.target.value))
                }
              />
            ) : null}
            <TextField
              label="Quiz score"
              max={100}
              min={0}
              type="number"
              value={quizScore}
              onChange={(event) => setQuizScore(Number(event.target.value))}
            />
            <TextField
              label="Portfolio score"
              max={100}
              min={0}
              type="number"
              value={portfolioScore}
              onChange={(event) =>
                setPortfolioScore(Number(event.target.value))
              }
            />
            <TextField
              label="Self-assessment score"
              max={100}
              min={0}
              type="number"
              value={selfAssessmentScore}
              onChange={(event) =>
                setSelfAssessmentScore(Number(event.target.value))
              }
            />
          </div>
          <StatCard
            helper="Preview only. Final result is calculated by the backend."
            label="Weighted Final Score"
            value={formatPercent(previewScore)}
          />
          <TextArea
            label="Assessor comment"
            rows={3}
            value={assessorComment}
            onChange={(event) => setAssessorComment(event.target.value)}
          />
          <div className="assessor-evidence-section">
            <strong>Evidence verification</strong>
            <div className="check-grid">
              {[
                ["githubReviewed", "GitHub project reviewed"],
                ["practicalEvidenceReviewed", "Practical evidence reviewed"],
                ["portfolioReviewed", "Portfolio evidence reviewed"],
                ["theoryReviewed", "Theory answers reviewed"],
              ].map(([key, label]) => (
                <label className="check-row" key={key}>
                  <input
                    checked={
                      Boolean(
                        evidenceVerification[
                          key as keyof typeof evidenceVerification
                        ],
                      )
                    }
                    type="checkbox"
                    onChange={(event) =>
                      setEvidenceVerification((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <TextArea
              label="Authenticity notes"
              rows={2}
              value={evidenceVerification.authenticityNotes}
              onChange={(event) =>
                setEvidenceVerification((current) => ({
                  ...current,
                  authenticityNotes: event.target.value,
                }))
              }
            />
          </div>
          <TextArea
            label="Recommendation message"
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <TextArea
            label="Action items, one per line"
            rows={4}
            value={actionItems}
            onChange={(event) => setActionItems(event.target.value)}
          />
          <Button type="submit">Save Review</Button>
        </form>
      </div>
    </Card>
  );
}

export function GapResultsPage({ token }: { token: string }) {
  const { data, isLoading, error, refresh } = useAsyncData(
    () => api.results(token),
    [] as Assessment[],
  );
  const { data: recommendations } = useAsyncData(
    () => api.recommendations(token),
    [] as Recommendation[],
  );

  if (isLoading) return <LoadingState message="Loading gap results..." />;

  return (
    <section className="page-stack">
      <PageHeader
        title="Gap Results"
        description="Each result connects the graduate score, RTB benchmark, gap level, and assessor recommendation."
        onRefresh={refresh}
      />
      {error && <Alert type="error">{error}</Alert>}
      {data.length === 0 ? (
        <EmptyState message="No reviewed results yet." />
      ) : (
        <div className="result-grid">
          {data.map((assessment) => {
            const recommendation = recommendations.find(
              (item) => item.competency._id === assessment.competency._id,
            );

            return (
              <Card key={assessment._id} title={assessment.competency.title}>
                <div className="result-card">
                  <div className="result-topline">
                    <GapBadge level={assessment.gapLevel} />
                    <span>Reviewed {formatDate(assessment.reviewedAt)}</span>
                  </div>
                  <ProgressBar value={assessment.scores.finalScore} />
                  <div className="result-metrics">
                    <span>
                      Graduate score:{" "}
                      {formatPercent(assessment.scores.finalScore)}
                    </span>
                    <span>
                      RTB benchmark: {formatPercent(assessment.benchmarkScore)}
                    </span>
                    <span>Skill gap: {formatPercent(assessment.skillGap)}</span>
                  </div>
                  <div className="assessor-note">
                    <strong>Assessor comment</strong>
                    <p>
                      {assessment.assessorComment ||
                        "No assessor comment provided."}
                    </p>
                  </div>
                  <div className="assessor-note">
                    <strong>Repository summary</strong>
                    <p>
                      {assessment.evidence.repositorySummary?.summaryText ||
                        "No GitHub repository summary was stored for this assessment."}
                    </p>
                    {assessment.evidence.repositorySummary && (
                      <div className="result-metrics">
                        <span>
                          Repository quality:{" "}
                          {formatPercent(
                            assessment.evidence.repositorySummary
                              .codeQualityScore || 0,
                          )}
                        </span>
                        <span>
                          Evidence completeness:{" "}
                          {formatPercent(
                            assessment.evidence.repositorySummary
                              .evidenceCompletenessScore || 0,
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  {assessment.scores.rubricScores?.length ? (
                    <div className="assessor-note">
                      <strong>Rubric scoring</strong>
                      <ul>
                        {assessment.scores.rubricScores.map((score) => (
                          <li key={score.criterionId || score.name}>
                            {score.name}: {formatPercent(score.score)} (
                            {score.weight}% weight)
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="assessor-note">
                    <strong>Evidence verification</strong>
                    <p>
                      {assessment.evidenceVerification
                        ? [
                            assessment.evidenceVerification.githubReviewed
                              ? "GitHub reviewed"
                              : "",
                            assessment.evidenceVerification
                              .practicalEvidenceReviewed
                              ? "Practical reviewed"
                              : "",
                            assessment.evidenceVerification.portfolioReviewed
                              ? "Portfolio reviewed"
                              : "",
                            assessment.evidenceVerification.theoryReviewed
                              ? "Theory reviewed"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(", ") || "Verification checks not recorded."
                        : "Verification checks not recorded."}
                    </p>
                    {assessment.evidenceVerification?.authenticityNotes && (
                      <p>{assessment.evidenceVerification.authenticityNotes}</p>
                    )}
                  </div>
                  <div className="assessor-note">
                    <strong>Recommendation</strong>
                    <p>
                      {recommendation?.message ||
                        "Recommendation will appear after the assessor adds improvement guidance."}
                    </p>
                    {recommendation &&
                      recommendation.actionItems.length > 0 && (
                        <ul>
                          {recommendation.actionItems.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function RecommendationsPage({ token }: { token: string }) {
  const { data, isLoading, error, refresh } = useAsyncData(
    () => api.recommendations(token),
    [] as Recommendation[],
  );

  if (isLoading) return <LoadingState message="Loading recommendations..." />;

  return (
    <section className="page-stack">
      <PageHeader
        title="Recommendations"
        description="Competency-specific improvement guidance linked to skill gap results."
        onRefresh={refresh}
      />
      {error && <Alert type="error">{error}</Alert>}
      {data.length === 0 ? (
        <EmptyState message="No recommendations found." />
      ) : (
        <div className="card-list">
          {data.map((recommendation) => (
            <Card
              key={recommendation._id}
              title={recommendation.competency.title}
            >
              <div className="recommendation">
                <GapBadge level={recommendation.gapLevel} />
                <p>{recommendation.message}</p>
                {recommendation.draftMessage &&
                  recommendation.draftMessage !== recommendation.message && (
                    <p>{recommendation.draftMessage}</p>
                  )}
                {recommendation.actionItems.length > 0 && (
                  <ul>
                    {recommendation.actionItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export function ReportsPage({ token, role }: PageProps) {
  const { data, isLoading, error, refresh } = useAsyncData(
    () => api.reports(token),
    [] as Report[],
  );
  const [graduateId, setGraduateId] = useState("");
  const [message, setMessage] = useState("");

  async function handleGenerate() {
    setMessage("");
    await api.generateReport(
      token,
      role === "graduate" ? undefined : graduateId,
    );
    setMessage("Report generated successfully.");
    await refresh();
  }

  function downloadReport(report: Report) {
    const reportHtml = buildReportHtml(report);
    const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <LoadingState message="Loading reports..." />;

  return (
    <section className="page-stack">
      <PageHeader
        title="Reports"
        description="Generate and review report summaries for competency performance."
        onRefresh={refresh}
      />
      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}
      <Card
        actions={<Button onClick={handleGenerate}>Generate Report</Button>}
        title="Report generation"
      >
        {role !== "graduate" && (
          <TextField
            label="Graduate user ID"
            value={graduateId}
            onChange={(event) => setGraduateId(event.target.value)}
          />
        )}
      </Card>
      {data.length === 0 ? (
        <EmptyState message="No reports generated yet." />
      ) : (
        <div className="card-list">
          {data.map((report) => (
            <Card
              actions={
                <Button
                  variant="secondary"
                  onClick={() => downloadReport(report)}
                >
                  Download Report
                </Button>
              }
              key={report._id}
              title={report.title}
            >
              <p>{report.summary}</p>
              <div className="result-metrics">
                <span>Overall score: {formatPercent(report.overallScore)}</span>
                <span>Gap level: {report.overallGapLevel}</span>
                <span>Generated: {formatDate(report.createdAt)}</span>
              </div>
              {report.assessments && report.assessments.length > 0 && (
                <div className="report-preview">
                  <strong>Included competencies</strong>
                  <ul>
                    {report.assessments.map((assessment) => (
                      <li key={assessment._id}>
                        {assessment.competency.title} -{" "}
                        {formatPercent(assessment.scores.finalScore)} -{" "}
                        {assessment.gapLevel}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.assessments && report.assessments.length > 0 && (
                <div className="report-preview">
                  <strong>Repository summaries</strong>
                  <ul>
                    {report.assessments.map((assessment) => (
                      <li key={`${report._id}-${assessment._id}-repo`}>
                        {assessment.competency.title}:{" "}
                        {assessment.evidence.repositorySummary?.summaryText ||
                          "No repository summary available."}
                        {assessment.evidence.repositorySummary && (
                          <>
                            {" "}
                            Quality{" "}
                            {formatPercent(
                              assessment.evidence.repositorySummary
                                .codeQualityScore || 0,
                            )}
                            , completeness{" "}
                            {formatPercent(
                              assessment.evidence.repositorySummary
                                .evidenceCompletenessScore || 0,
                            )}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function escapeHtml(value: string | number | undefined) {
  return String(value ?? "N/A")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildReportHtml(report: Report) {
  const assessments = report.assessments || [];
  const recommendations = report.recommendations || [];
  const recommendationFor = (assessment: Assessment) =>
    recommendations.find(
      (item) => item.competency._id === assessment.competency._id,
    );
  const repositoryDetails = assessments
    .map((assessment) => {
      const summary = assessment.evidence.repositorySummary;
      const sampledFiles =
        summary?.sampledSourceFiles
          ?.map(
            (file) =>
              `<li>${escapeHtml(file.path)} (${escapeHtml(file.language)}): ${escapeHtml(file.excerpt || "")}</li>`,
          )
          .join("") || "<li>No sampled source file excerpts available.</li>";
      const rubricScores =
        assessment.scores.rubricScores
          ?.map(
            (score) =>
              `<li>${escapeHtml(score.name)}: ${escapeHtml(formatPercent(score.score))} (${escapeHtml(score.weight)}% weight) ${score.comment ? `- ${escapeHtml(score.comment)}` : ""}</li>`,
          )
          .join("") || "<li>No rubric criterion scores recorded.</li>";
      const riskFlags =
        summary?.riskFlags
          ?.map((flag) => `<li>${escapeHtml(flag)}</li>`)
          .join("") || "<li>No repository risk flags recorded.</li>";
      const verification = assessment.evidenceVerification
        ? [
            assessment.evidenceVerification.githubReviewed
              ? "GitHub project reviewed"
              : "",
            assessment.evidenceVerification.practicalEvidenceReviewed
              ? "Practical evidence reviewed"
              : "",
            assessment.evidenceVerification.portfolioReviewed
              ? "Portfolio evidence reviewed"
              : "",
            assessment.evidenceVerification.theoryReviewed
              ? "Theory answers reviewed"
              : "",
          ]
            .filter(Boolean)
            .join(", ") || "No verification checks recorded."
        : "No verification checks recorded.";

      return `<section class="summary">
        <h3>${escapeHtml(assessment.competency.title)}</h3>
        <p>${escapeHtml(summary?.summaryText || "No repository summary available.")}</p>
        <p><strong>Repository quality:</strong> ${escapeHtml(formatPercent(summary?.codeQualityScore || 0))}</p>
        <p><strong>Evidence completeness:</strong> ${escapeHtml(formatPercent(summary?.evidenceCompletenessScore || 0))}</p>
        <p><strong>Evidence verification:</strong> ${escapeHtml(verification)}</p>
        <p><strong>Authenticity notes:</strong> ${escapeHtml(assessment.evidenceVerification?.authenticityNotes || "N/A")}</p>
        <p><strong>README:</strong> ${escapeHtml(summary?.readmeExcerpt || "No README excerpt available.")}</p>
        <h4>Repository risk flags</h4>
        <ul>${riskFlags}</ul>
        <h4>Rubric scores</h4>
        <ul>${rubricScores}</ul>
        <h4>Sampled source files</h4>
        <ul>${sampledFiles}</ul>
      </section>`;
    })
    .join("");

  const assessmentRows = assessments
    .map((assessment) => {
      const recommendation = recommendationFor(assessment);
      return `
        <tr>
          <td>${escapeHtml(assessment.competency.title)}</td>
          <td>${escapeHtml(formatPercent(assessment.scores.finalScore))}</td>
          <td>${escapeHtml(formatPercent(assessment.benchmarkScore))}</td>
          <td>${escapeHtml(formatPercent(assessment.skillGap))}</td>
          <td>${escapeHtml(assessment.gapLevel)}</td>
          <td>${escapeHtml(assessment.assessorComment || "")}</td>
          <td>${escapeHtml(recommendation?.message || "")}</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(report.title)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #17202a; margin: 32px; line-height: 1.5; }
      h1 { margin-bottom: 4px; }
      .meta { color: #617285; margin-bottom: 24px; }
      .summary { border: 1px solid #dbe2ea; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
      table { border-collapse: collapse; width: 100%; margin-top: 16px; }
      th, td { border: 1px solid #dbe2ea; padding: 10px; text-align: left; vertical-align: top; }
      th { background: #f1f5f9; }
      .pill { display: inline-block; background: #e8f5f2; border-radius: 999px; padding: 4px 10px; margin-right: 6px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(report.title)}</h1>
    <div class="meta">
      Graduate: ${escapeHtml(report.graduate?.name)} |
      Institution: ${escapeHtml(report.graduate?.institution)} |
      Generated: ${escapeHtml(formatDate(report.createdAt))}
    </div>
    <div class="summary">
      <strong>Overall Score:</strong> ${escapeHtml(formatPercent(report.overallScore))}<br />
      <strong>Overall Gap Level:</strong> ${escapeHtml(report.overallGapLevel)}<br />
      <strong>Summary:</strong> ${escapeHtml(report.summary)}
    </div>
    <p>
      <strong>Strengths:</strong>
      ${(report.strengths || []).map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("") || "N/A"}
    </p>
    <p>
      <strong>Weaknesses:</strong>
      ${(report.weaknesses || []).map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("") || "N/A"}
    </p>
    <h2>Repository Summaries</h2>
    <ul>
      ${
        assessments
          .map(
            (assessment) =>
              `<li><strong>${escapeHtml(assessment.competency.title)}</strong>: ${escapeHtml(
                assessment.evidence.repositorySummary?.summaryText ||
                  "No repository summary available.",
              )}</li>`,
          )
          .join("") || "<li>No repository summaries available.</li>"
      }
    </ul>
    ${repositoryDetails}
    <h2>Competency Results</h2>
    <table>
      <thead>
        <tr>
          <th>Competency</th>
          <th>Graduate Score</th>
          <th>RTB Benchmark</th>
          <th>Skill Gap</th>
          <th>Gap Level</th>
          <th>Assessor Comment</th>
          <th>Recommendation</th>
        </tr>
      </thead>
      <tbody>${assessmentRows || '<tr><td colspan="7">No assessment results found.</td></tr>'}</tbody>
    </table>
  </body>
</html>`;
}

export function NotificationsPage({ token, role }: PageProps) {
  if (role === "admin") {
    return <AdminNotificationsPage token={token} />;
  }

  const { data, isLoading, error, refresh } = useAsyncData(
    () => api.notifications(token),
    [] as NotificationItem[],
  );
  const unreadCount = data.filter(
    (notification) => !notification.isRead,
  ).length;

  async function markRead(id: string) {
    await api.markNotificationRead(token, id);
    await refresh();
  }

  async function markAllRead() {
    await api.markAllNotificationsRead(token);
    await refresh();
  }

  if (isLoading) return <LoadingState message="Loading notifications..." />;

  return (
    <section className="page-stack">
      <PageHeader
        title="Notifications"
        description="System updates about assessments, reports, and recommendations."
        onRefresh={refresh}
      />
      {error && <Alert type="error">{error}</Alert>}
      <div className="status-summary-grid">
        <StatCard helper="Need attention" label="Unread" value={unreadCount} />
        <StatCard helper="All messages" label="Total" value={data.length} />
        <StatCard
          helper="Assessment, recommendation, report, system"
          label="Categories"
          value={new Set(data.map((item) => item.type)).size}
        />
      </div>
      {unreadCount > 0 && (
        <div className="button-row">
          <Button variant="secondary" onClick={() => void markAllRead()}>
            Mark All Read
          </Button>
        </div>
      )}
      {data.length === 0 ? (
        <EmptyState message="No notifications yet." />
      ) : (
        <div className="card-list">
          {data.map((notification) => (
            <Card
              actions={
                !notification.isRead && (
                  <Button
                    variant="secondary"
                    onClick={() => void markRead(notification._id)}
                  >
                    Mark read
                  </Button>
                )
              }
              key={notification._id}
              title={notification.title}
            >
              <div
                className={`notification-item ${notification.isRead ? "read" : "unread"}`}
              >
                <div className="compact-meta">
                  <span>{notification.type}</span>
                  <span>{formatDate(notification.createdAt)}</span>
                </div>
                <p>{notification.message}</p>
                {!notification.isRead && <strong>Unread</strong>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function AdminNotificationsPage({ token }: { token: string }) {
  const { data, isLoading, error, refresh } = useAsyncData(
    () => api.allNotifications(token),
    [] as NotificationItem[],
  );
  const [form, setForm] = useState({
    title: "",
    message: "",
    type: "system" as NotificationItem["type"],
    role: "all" as Role | "all",
    recipientId: "",
  });
  const [message, setMessage] = useState("");
  const unreadCount = data.filter(
    (notification) => !notification.isRead,
  ).length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    await api.createNotification(token, {
      title: form.title,
      message: form.message,
      type: form.type,
      role: form.recipientId ? undefined : form.role,
      recipientId: form.recipientId || undefined,
    });
    setMessage("Notification sent successfully.");
    setForm({
      title: "",
      message: "",
      type: "system",
      role: "all",
      recipientId: "",
    });
    await refresh();
  }

  if (isLoading)
    return <LoadingState message="Loading notification manager..." />;

  return (
    <section className="page-stack">
      <PageHeader
        description="Send system notifications and monitor all notification activity."
        onRefresh={refresh}
        title="Manage Notifications"
      />
      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}

      <div className="status-summary-grid">
        <StatCard helper="Need attention" label="Unread" value={unreadCount} />
        <StatCard
          helper="All sent and generated messages"
          label="Total"
          value={data.length}
        />
        <StatCard
          helper="Unique recipients"
          label="Recipients"
          value={
            new Set(
              data.map((item) => item.recipient?.id || item.recipient?._id),
            ).size
          }
        />
      </div>

      <Card title="Send notification">
        <form className="form-grid" onSubmit={handleSubmit}>
          <TextField
            label="Title"
            required
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
          />
          <SelectField
            label="Type"
            value={form.type}
            onChange={(event) =>
              setForm({
                ...form,
                type: event.target.value as NotificationItem["type"],
              })
            }
          >
            <option value="system">System</option>
            <option value="assessment">Assessment</option>
            <option value="recommendation">Recommendation</option>
            <option value="report">Report</option>
          </SelectField>
          <SelectField
            label="Send to role"
            value={form.role}
            onChange={(event) =>
              setForm({ ...form, role: event.target.value as Role | "all" })
            }
          >
            <option value="all">All users</option>
            <option value="graduate">Graduates</option>
            <option value="assessor">Assessors</option>
            <option value="admin">Admins</option>
          </SelectField>
          <TextField
            label="Specific user ID"
            placeholder="Optional. Overrides role selection."
            value={form.recipientId}
            onChange={(event) =>
              setForm({ ...form, recipientId: event.target.value })
            }
          />
          <div className="full-span">
            <TextArea
              label="Message"
              required
              rows={4}
              value={form.message}
              onChange={(event) =>
                setForm({ ...form, message: event.target.value })
              }
            />
          </div>
          <Button type="submit">Send Notification</Button>
        </form>
      </Card>

      <Card title="Notification log">
        {data.length === 0 ? (
          <EmptyState message="No notifications found." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Recipient</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.map((notification) => (
                  <tr key={notification._id}>
                    <td>{notification.title}</td>
                    <td>
                      {notification.recipient?.name || "Unknown"}
                      <br />
                      <small>{notification.recipient?.role || "N/A"}</small>
                    </td>
                    <td>{notification.type}</td>
                    <td>{notification.isRead ? "Read" : "Unread"}</td>
                    <td>{formatDate(notification.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

export function UsersPage({ token }: { token: string }) {
  const { data, isLoading, error, refresh } = useAsyncData(
    () => api.users(token),
    [] as User[],
  );

  if (isLoading) return <LoadingState message="Loading users..." />;

  return (
    <section className="page-stack">
      <PageHeader
        title="User Management"
        description="View graduate, assessor, and admin accounts."
        onRefresh={refresh}
      />
      {error && <Alert type="error">{error}</Alert>}
      <Card title="Users">
        {data.length === 0 ? (
          <EmptyState message="No users found." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Institution</th>
                </tr>
              </thead>
              <tbody>
                {data.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{user.institution || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

export function CompetenciesPage({ token }: { token: string }) {
  const { data, isLoading, error, refresh } = useAsyncData(
    () => api.competencies(token),
    [] as Competency[],
  );
  const [form, setForm] = useState({
    code: "",
    title: "",
    category: "",
    description: "",
    expectedEvidence: "",
    practicalTaskTitle: "",
    practicalTaskInstructions: "",
    practicalTaskDeliverables: "",
    theoryQuestion: "",
    theoryOptions: "",
    theoryCorrectAnswer: "",
    portfolioRequirementTitle: "",
    portfolioRequirementDescription: "",
    rubricName: "",
    rubricDescription: "",
    rubricWeight: 100,
  });
  const [message, setMessage] = useState("");

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await api.createCompetency(token, {
      code: form.code,
      title: form.title,
      category: form.category,
      description: form.description,
      expectedEvidence: form.expectedEvidence,
      practicalTasks: form.practicalTaskTitle
        ? [
            {
              title: form.practicalTaskTitle,
              instructions: form.practicalTaskInstructions,
              deliverables: form.practicalTaskDeliverables,
              estimatedMinutes: 60,
              maxScore: 100,
            },
          ]
        : [],
      theoryQuestions: form.theoryQuestion
        ? [
            {
              question: form.theoryQuestion,
              type: "multiple_choice",
              options: form.theoryOptions
                .split("\n")
                .map((option) => option.trim())
                .filter(Boolean),
              correctAnswer: form.theoryCorrectAnswer,
              points: 1,
            },
          ]
        : [],
      portfolioRequirements: form.portfolioRequirementTitle
        ? [
            {
              title: form.portfolioRequirementTitle,
              description: form.portfolioRequirementDescription,
              required: true,
            },
          ]
        : [],
      rubricCriteria: form.rubricName
        ? [
            {
              name: form.rubricName,
              description: form.rubricDescription,
              weight: form.rubricWeight,
              maxScore: 100,
            },
          ]
        : [],
    });
    setForm({
      code: "",
      title: "",
      category: "",
      description: "",
      expectedEvidence: "",
      practicalTaskTitle: "",
      practicalTaskInstructions: "",
      practicalTaskDeliverables: "",
      theoryQuestion: "",
      theoryOptions: "",
      theoryCorrectAnswer: "",
      portfolioRequirementTitle: "",
      portfolioRequirementDescription: "",
      rubricName: "",
      rubricDescription: "",
      rubricWeight: 100,
    });
    setMessage("Competency created successfully.");
    await refresh();
  }

  if (isLoading) return <LoadingState message="Loading competencies..." />;

  return (
    <section className="page-stack">
      <PageHeader
        title="Competency Management"
        description="Maintain ICT competency standards used during assessments."
        onRefresh={refresh}
      />
      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}
      <Card title="Add real assessment competency">
        <form className="form-grid" onSubmit={handleCreate}>
          <TextField
            label="Code"
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
            required
          />
          <TextField
            label="Title"
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            required
          />
          <TextField
            label="Category"
            value={form.category}
            onChange={(event) =>
              setForm({ ...form, category: event.target.value })
            }
            required
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
          <TextField
            label="Expected evidence"
            value={form.expectedEvidence}
            onChange={(event) =>
              setForm({ ...form, expectedEvidence: event.target.value })
            }
          />
          <div className="full-span form-subsection">
            <h3>Practical test</h3>
            <div className="form-grid">
              <TextField
                label="Task title"
                value={form.practicalTaskTitle}
                onChange={(event) =>
                  setForm({ ...form, practicalTaskTitle: event.target.value })
                }
              />
              <TextField
                label="Deliverables"
                value={form.practicalTaskDeliverables}
                onChange={(event) =>
                  setForm({
                    ...form,
                    practicalTaskDeliverables: event.target.value,
                  })
                }
              />
              <div className="full-span">
                <TextArea
                  label="Task instructions"
                  rows={4}
                  value={form.practicalTaskInstructions}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      practicalTaskInstructions: event.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
          <div className="full-span form-subsection">
            <h3>Theory question</h3>
            <div className="form-grid">
              <TextField
                label="Question"
                value={form.theoryQuestion}
                onChange={(event) =>
                  setForm({ ...form, theoryQuestion: event.target.value })
                }
              />
              <TextField
                label="Correct answer"
                value={form.theoryCorrectAnswer}
                onChange={(event) =>
                  setForm({ ...form, theoryCorrectAnswer: event.target.value })
                }
              />
              <div className="full-span">
                <TextArea
                  label="Multiple-choice options, one per line"
                  rows={4}
                  value={form.theoryOptions}
                  onChange={(event) =>
                    setForm({ ...form, theoryOptions: event.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <div className="full-span form-subsection">
            <h3>Portfolio and rubric</h3>
            <div className="form-grid">
              <TextField
                label="Portfolio requirement"
                value={form.portfolioRequirementTitle}
                onChange={(event) =>
                  setForm({
                    ...form,
                    portfolioRequirementTitle: event.target.value,
                  })
                }
              />
              <TextField
                label="Rubric criterion"
                value={form.rubricName}
                onChange={(event) =>
                  setForm({ ...form, rubricName: event.target.value })
                }
              />
              <TextArea
                label="Portfolio requirement description"
                rows={3}
                value={form.portfolioRequirementDescription}
                onChange={(event) =>
                  setForm({
                    ...form,
                    portfolioRequirementDescription: event.target.value,
                  })
                }
              />
              <TextArea
                label="Rubric criterion description"
                rows={3}
                value={form.rubricDescription}
                onChange={(event) =>
                  setForm({ ...form, rubricDescription: event.target.value })
                }
              />
              <TextField
                label="Rubric weight"
                max={100}
                min={0}
                type="number"
                value={form.rubricWeight}
                onChange={(event) =>
                  setForm({ ...form, rubricWeight: Number(event.target.value) })
                }
              />
            </div>
          </div>
          <Button type="submit">Add Competency</Button>
        </form>
      </Card>
      <Card title="Current competencies">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Category</th>
                <th>Expected Evidence</th>
                <th>Assessment Content</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item._id}>
                  <td>{item.code}</td>
                  <td>{item.title}</td>
                  <td>{item.category}</td>
                  <td>{item.expectedEvidence || "N/A"}</td>
                  <td>
                    {item.practicalTasks?.length || 0} task(s),{" "}
                    {item.theoryQuestions?.length || 0} question(s),{" "}
                    {item.rubricCriteria?.length || 0} rubric item(s)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

export function BenchmarksPage({ token }: { token: string }) {
  const {
    data: benchmarks,
    isLoading,
    error,
    refresh,
  } = useAsyncData(() => api.benchmarks(token), [] as Benchmark[]);
  const { data: competencies } = useAsyncData(
    () => api.competencies(token),
    [] as Competency[],
  );
  const [form, setForm] = useState({
    competency: "",
    requiredScore: 80,
    level: "intermediate",
    description: "",
  });
  const [message, setMessage] = useState("");

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await api.createBenchmark(token, form);
    setMessage("Benchmark saved successfully.");
    await refresh();
  }

  if (isLoading) return <LoadingState message="Loading benchmarks..." />;

  return (
    <section className="page-stack">
      <PageHeader
        title="RTB Benchmark Management"
        description="Define the required score for each ICT competency."
        onRefresh={refresh}
      />
      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}
      <Card title="Add benchmark">
        <form className="form-grid" onSubmit={handleCreate}>
          <SelectField
            label="Competency"
            value={form.competency}
            onChange={(event) =>
              setForm({ ...form, competency: event.target.value })
            }
            required
          >
            <option value="">Select competency</option>
            {competencies.map((item) => (
              <option key={item._id} value={item._id}>
                {item.code} - {item.title}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Required score"
            max={100}
            min={0}
            type="number"
            value={form.requiredScore}
            onChange={(event) =>
              setForm({ ...form, requiredScore: Number(event.target.value) })
            }
          />
          <SelectField
            label="Level"
            value={form.level}
            onChange={(event) =>
              setForm({ ...form, level: event.target.value })
            }
          >
            <option value="basic">Basic</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </SelectField>
          <TextField
            label="Description"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
          <Button type="submit">Save Benchmark</Button>
        </form>
      </Card>
      <Card title="Active benchmarks">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Competency</th>
                <th>Required Score</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((item) => (
                <tr key={item._id}>
                  <td>{item.competency.title}</td>
                  <td>{formatPercent(item.requiredScore)}</td>
                  <td>{item.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function PageHeader({
  title,
  description,
  onRefresh,
}: {
  title: string;
  description: string;
  onRefresh?: () => Promise<void>;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {onRefresh && (
        <Button variant="secondary" onClick={() => void onRefresh()}>
          Refresh
        </Button>
      )}
    </div>
  );
}

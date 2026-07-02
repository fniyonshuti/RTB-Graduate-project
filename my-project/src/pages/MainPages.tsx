import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { api } from "../api/client";
import type { ViewKey } from "../components/layout";
import {
  Alert,
  Badge,
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
  Organization,
  Recommendation,
  RepositoryTaskReview,
  Report,
  Role,
  User,
} from "../types";
import { formatDate, formatPercent, readableStatus } from "../utils/gapLevels";
import { isLearnerRole, roleLabel } from "../utils/roles";

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
  const loadRef = useRef(load);
  const initialDataRef = useRef(initialData);
  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    isLoading: true,
    error: "",
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true, error: "" }));
    try {
      const data = await loadRef.current();
      setState({ data, isLoading: false, error: "" });
    } catch (caughtError) {
      setState({
        data: initialDataRef.current,
        isLoading: false,
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load data",
      });
    }
  }, []);

  useEffect(() => {
    loadRef.current = load;
    initialDataRef.current = initialData;
  }, [initialData, load]);

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialData() {
      try {
        const data = await loadRef.current();
        if (isCurrent) setState({ data, isLoading: false, error: "" });
      } catch (caughtError) {
        if (!isCurrent) return;

        setState({
          data: initialDataRef.current,
          isLoading: false,
          error:
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load data",
        });
      }
    }

    void loadInitialData();

    return () => {
      isCurrent = false;
    };
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

  if (isLearnerRole(role)) {
    return (
      <GraduateDashboard
        data={data}
        error={error}
        onNavigate={onNavigate}
        onRefresh={refresh}
      />
    );
  }

  const cards = [
    ["Total Users", dashboardNumber(data, "totalGraduates")],
    ["Organization Users", dashboardNumber(data, "totalOrganizationUsers")],
    ["Organization Admins", dashboardNumber(data, "totalOrganizationAdmins")],
    [
      "Average Skill Gap",
      formatPercent(dashboardNumber(data, "averageSkillGap")),
    ],
  ];

  return (
    <section className="page-stack">
      <PageHeader
        title={`${roleLabel(role)} Dashboard`}
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
          <span>GitHub task review</span>
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
          <span className="eyebrow">Assessment workspace</span>
          <h1>Know your ICT skill gaps and what to improve next.</h1>
          <p>
            Submit practical evidence, receive automatic scoring, then compare
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
                ? "Open your gap results, focus on moderate and high gap competencies, and follow the automatic recommendations."
                : "Start by selecting one ICT competency and submitting GitHub practical evidence plus quiz/theory answers."}
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
              text="Submit GitHub practical evidence and quiz/theory answers."
            />
            <WorkflowStep
              label="3"
              text="The system verifies the GitHub task review and theory answers automatically."
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
            <EmptyState message="Recommendations appear here after automatic scoring completes." />
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
          <WeightBox label="Practical / GitHub project" value="70%" />
          <WeightBox label="Quiz / theory" value="30%" />
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

  if (isLoading) return <LoadingState message="Loading profile..." />;

  return (
    <GraduateProfileForm
      error={error}
      initialProfile={data || {}}
      token={token}
    />
  );
}

function GraduateProfileForm({
  error,
  initialProfile,
  token,
}: {
  error: string;
  initialProfile: GraduateProfile;
  token: string;
}) {
  const [profile, setProfile] = useState<GraduateProfile>(initialProfile);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const savedProfile = await api.saveProfile(token, profile);
    setProfile(savedProfile);
    setMessage("Profile saved successfully.");
  }

  return (
    <section className="page-stack">
      <PageHeader
        title="User Profile"
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
  const [practicalTask, setPracticalTask] = useState("");
  const [githubRepositoryUrl, setGithubRepositoryUrl] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<
    { name: string; type?: string; size?: number; dataUrl: string }[]
  >([]);
  const [theoryAnswers, setTheoryAnswers] = useState<Record<string, string>>(
    {},
  );
  const [repositoryTaskReview, setRepositoryTaskReview] =
    useState<{
      competency: string;
      githubRepositoryUrl: string;
      practicalTaskId: string;
      taskReview: RepositoryTaskReview;
    } | null>(null);
  const [isReviewingRepository, setIsReviewingRepository] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedCompetency = competencies.find(
    (item) => item._id === competency,
  );
  const availableTasks = selectedCompetency?.practicalTasks || [];
  const selectedTask =
    availableTasks.find((task) => task._id === practicalTaskId) ||
    availableTasks[0];
  const reviewedRepositoryUrl = githubRepositoryUrl.trim();
  const activeRepositoryTaskReview =
    repositoryTaskReview &&
    repositoryTaskReview.competency === competency &&
    repositoryTaskReview.githubRepositoryUrl === reviewedRepositoryUrl &&
    repositoryTaskReview.practicalTaskId === (selectedTask?._id || "")
      ? repositoryTaskReview.taskReview
      : null;
  const theoryQuestions = selectedCompetency?.theoryQuestions || [];
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
  ].filter((value) => value.trim().length > 0).length;
  const canContinueToEvidence = Boolean(competency);
  const practicalEvidenceReady =
    reviewedRepositoryUrl.length > 0 && Boolean(activeRepositoryTaskReview);
  const canReview =
    practicalEvidenceReady &&
    requiredTheoryAnswered;
  const canSubmit =
    Boolean(competency) &&
    practicalEvidenceReady &&
    requiredTheoryAnswered;

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
        practicalSubmissionMode: "mixed",
        practicalTaskId: selectedTask?._id,
        practicalTask,
        githubRepositoryUrl,
        evidenceFiles,
        repositoryTaskReview: activeRepositoryTaskReview || undefined,
        theoryAnswers: theoryQuestions.map((question) => ({
          questionId: question._id,
          answer: theoryAnswers[question._id] || "",
        })),
      });
      setMessage("Assessment completed. Automatic scores, gap results, recommendations, and report are ready.");
      setPracticalTask("");
      setGithubRepositoryUrl("");
      setEvidenceFiles([]);
      setPracticalTaskId("");
      setTheoryAnswers({});
      setRepositoryTaskReview(null);
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

  async function handleRepositoryTaskReview() {
    setError("");
    setMessage("");

    if (!selectedCompetency || !selectedTask) {
      setError("Select a competency and practical task before reviewing.");
      return;
    }

    if (!githubRepositoryUrl.trim()) {
      setError("Enter a GitHub repository URL before reviewing the task.");
      return;
    }

    setIsReviewingRepository(true);

    try {
      const result = await api.reviewRepositoryTask(token, {
        competency: selectedCompetency._id,
        practicalTaskId: selectedTask._id,
        githubRepositoryUrl,
      });

      setRepositoryTaskReview({
        competency: selectedCompetency._id,
        githubRepositoryUrl: reviewedRepositoryUrl,
        practicalTaskId: selectedTask._id,
        taskReview: result.taskReview,
      });
      setMessage("Repository task review completed. Check the task score and checklist.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Repository review failed",
      );
    } finally {
      setIsReviewingRepository(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading competencies..." />;

  return (
    <section className="page-stack">
      <PageHeader
        title="Take Competency Assessment"
        description="Complete one competency at a time. Repository evidence is scored automatically before final gap results are calculated."
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
                text="Review & submit"
              />
            </div>
          </Card>

          <Card title="Scoring model">
            <div className="score-weight-list">
              <span>
                <strong>70%</strong> Practical/GitHub project
              </span>
              <span>
                <strong>30%</strong> Quiz / theory
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
                        {availableTasks.length} practical task(s) and{" "}
                        {theoryQuestions.length} theory question(s).
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
                  Practical evidence is based on a GitHub repository. The
                  system scans the repository against the selected task and
                  shows a checklist score before you submit for automatic scoring.
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
                  <div className="task-review-card">
                    <div className="task-review-header">
                      <div>
                        <span className="task-number">Practical task</span>
                        <h3>{selectedTask.title}</h3>
                      </div>
                      <span className="mandatory-pill">mandatory</span>
                    </div>
                    {activeRepositoryTaskReview && (
                      <div className="task-score-strip">
                        <span>
                          Score: {formatPercent(activeRepositoryTaskReview.score)}
                        </span>
                        <em>
                          Checks completed:{" "}
                          {formatPercent(
                            (activeRepositoryTaskReview.passedCount /
                              Math.max(
                                activeRepositoryTaskReview.checklist.length,
                                1,
                              )) *
                              100,
                          )}
                        </em>
                        <strong>
                          {activeRepositoryTaskReview.pointsEarned}/
                          {activeRepositoryTaskReview.pointsPossible} pts
                        </strong>
                      </div>
                    )}
                    <p>{selectedTask.instructions}</p>
                    {selectedTask.deliverables && (
                      <div>
                        <strong>Required deliverables</strong>
                        <p>{selectedTask.deliverables}</p>
                      </div>
                    )}
                    <TextField
                      label="GitHub repository evidence URL"
                      type="url"
                      value={githubRepositoryUrl}
                      onChange={(event) =>
                        setGithubRepositoryUrl(event.target.value)
                      }
                      placeholder="https://github.com/username/project"
                      required
                    />
                    <div className="button-row">
                      <Button
                        disabled={
                          isReviewingRepository ||
                          !githubRepositoryUrl.trim()
                        }
                        variant="secondary"
                        onClick={() => void handleRepositoryTaskReview()}
                      >
                        {isReviewingRepository
                          ? "Reviewing repository..."
                          : "Review repository"}
                      </Button>
                      <Button
                        disabled={!activeRepositoryTaskReview}
                        variant="ghost"
                        onClick={() =>
                          document
                            .getElementById("repository-review-result")
                            ?.scrollIntoView({ behavior: "smooth" })
                        }
                      >
                        View results
                      </Button>
                    </div>
                    {activeRepositoryTaskReview && (
                      <div
                        className="repository-review-result"
                        id="repository-review-result"
                      >
                        <div className="compact-meta">
                          <strong>Automatic review result</strong>
                          <span>
                            {activeRepositoryTaskReview.passedCount}/
                            {activeRepositoryTaskReview.checklist.length} passed
                          </span>
                        </div>
                        {activeRepositoryTaskReview.implementationReview && (
                          <div className="assessor-note">
                            <strong>Implementation evidence</strong>
                            {activeRepositoryTaskReview.proofLevel && (
                              <p>
                                Proof level:{" "}
                                <strong>{activeRepositoryTaskReview.proofLevel}</strong>
                              </p>
                            )}
                            {activeRepositoryTaskReview.proofSummary && (
                              <p>{activeRepositoryTaskReview.proofSummary}</p>
                            )}
                            <p>
                              Source files reviewed:{" "}
                              {
                                activeRepositoryTaskReview.implementationReview
                                  .sourceFilesReviewed
                              }
                              . Implementation evidence score:{" "}
                              {formatPercent(
                                activeRepositoryTaskReview.implementationReview
                                  .implementationEvidenceScore || 0,
                              )}
                              . Functional coverage:{" "}
                              {formatPercent(
                                activeRepositoryTaskReview.implementationReview
                                  .functionalCoverageRate || 0,
                              )}
                              .
                            </p>
                            <p>
                              Detected:{" "}
                              {activeRepositoryTaskReview.implementationReview
                                .detectedFunctionalAreas?.length
                                ? activeRepositoryTaskReview.implementationReview.detectedFunctionalAreas.join(
                                    ", ",
                                  )
                                : "No strong implementation signals detected."}
                            </p>
                            {activeRepositoryTaskReview.implementationReview
                              .missingFunctionalAreas?.length ? (
                              <p>
                                Missing:{" "}
                                {activeRepositoryTaskReview.implementationReview.missingFunctionalAreas.join(
                                  ", ",
                                )}
                              </p>
                            ) : null}
                          </div>
                        )}
                        <div className="task-checklist">
                          {activeRepositoryTaskReview.checklist.map((item) => (
                            <div
                              className={`task-check ${
                                item.passed ? "passed" : "failed"
                              }`}
                              key={item.key}
                            >
                              <span>{item.passed ? "Passed" : "Failed"}</span>
                              <div>
                                <strong>{item.label}</strong>
                                <p>{item.evidence}</p>
                                {!item.passed && item.advice && (
                                  <small>{item.advice}</small>
                                )}
                              </div>
                              <em>{item.weight} pts</em>
                            </div>
                          ))}
                        </div>
                        {activeRepositoryTaskReview.competencyScores && (
                          <div className="assessor-note">
                            <strong>Competency score breakdown</strong>
                            <div className="result-grid">
                              {Object.entries(
                                activeRepositoryTaskReview.competencyScores,
                              ).map(([key, value]) => (
                                <div key={key}>
                                  <small>{key}</small>
                                  <strong>{formatPercent(value || 0)}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {activeRepositoryTaskReview.recommendations?.length ? (
                          <div className="assessor-note warning-note">
                            <strong>Repository recommendations</strong>
                            <ul>
                              {activeRepositoryTaskReview.recommendations.map(
                                (item) => (
                                  <li key={item}>{item}</li>
                                ),
                              )}
                            </ul>
                          </div>
                        ) : null}
                        {activeRepositoryTaskReview.feedback?.length ? (
                          <div className="assessor-note warning-note">
                            <strong>Improve before submission</strong>
                            <ul>
                              {activeRepositoryTaskReview.feedback.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <Alert type="success">
                            All repository checklist items passed for this task.
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <TextArea
                  label="Supporting explanation"
                  rows={5}
                  value={practicalTask}
                  onChange={(event) => setPracticalTask(event.target.value)}
                  placeholder="Optional: explain what you completed, commands used, files created, test results, or deployment link."
                />

                <div className="upload-panel">
                  <label className="file-drop">
                    <span>Upload project files or folders</span>
                    <input
                      multiple
                      {...({ webkitdirectory: "" } as Record<string, string>)}
                      onChange={(event) =>
                        void handleEvidenceFiles(event.target.files)
                      }
                      type="file"
                    />
                  </label>
                  <small>
                    Optional supporting evidence: project folder, screenshots,
                    PDFs, exported work, source files, or images. Maximum 2MB
                    per file.
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

                <div className="evidence-readiness">
                  <strong>
                    {Math.min(evidenceCount, 4)}/4 evidence sections completed
                  </strong>
                  <ProgressBar value={Math.min(evidenceCount, 4) * 25} />
                </div>
                <div className="button-row">
                  <Button variant="secondary" onClick={() => setCurrentStep(1)}>
                    Back
                  </Button>
                  <Button
                    disabled={!canReview}
                    onClick={() => setCurrentStep(3)}
                  >
                    Review Submission
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {currentStep === 3 && (
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
                  value="GitHub review + upload evidence"
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
                  label="Automatic repository task score"
                  value={
                    activeRepositoryTaskReview
                      ? `${formatPercent(activeRepositoryTaskReview.score)} (${activeRepositoryTaskReview.passedCount}/${activeRepositoryTaskReview.checklist.length} checks passed)`
                      : "Repository task review not completed"
                  }
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
              </div>
              <div className="button-row">
                <Button variant="secondary" onClick={() => setCurrentStep(2)}>
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
  const [statusFilter, setStatusFilter] = useState("submitted");
  const [assessmentSearch, setAssessmentSearch] = useState("");

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
  const normalizedSearch = assessmentSearch.trim().toLowerCase();
  const filteredAssessments = data.filter((assessment) => {
    const matchesStatus =
      statusFilter === "all" || assessment.status === statusFilter;
    const matchesSearch =
      normalizedSearch.length === 0 ||
      [
        assessment.competency.title,
        assessment.competency.code,
        assessment.graduate.name,
        assessment.graduate.email,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));

    return matchesStatus && matchesSearch;
  });
  const queueStatusOptions = [
    { label: "Submitted", value: "submitted", count: submittedCount },
    { label: "Reviewed", value: "reviewed", count: reviewedCount },
    { label: "Returned", value: "returned", count: returnedCount },
    { label: "All", value: "all", count: data.length },
  ];

  function selectAssessmentForReview(assessment: Assessment) {
    setSelected(assessment);
    window.setTimeout(() => {
      document
        .getElementById("assessment-review")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  return (
    <section className="page-stack">
      <PageHeader
        title={
          role === "assessor"
            ? "Assessment Reviews"
            : role === "admin" || role === "super_admin"
              ? "All Assessments"
              : "My Assessments"
        }
        description="Track submitted evidence, review status, final scores, and gap levels."
        onRefresh={refresh}
      />
      {error && <Alert type="error">{error}</Alert>}
      <div className="status-summary-grid">
        <StatCard
          helper="Automatic scoring in progress"
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
      {role === "assessor" ? (
        <Card title="Assessment review queue">
          {data.length === 0 ? (
            <EmptyState message="No assessments found." />
          ) : (
            <div className="assessor-queue">
              <div className="assessment-toolbar">
                <div className="status-filter-group">
                  {queueStatusOptions.map((option) => (
                    <button
                      className={statusFilter === option.value ? "active" : ""}
                      key={option.value}
                      type="button"
                      onClick={() => setStatusFilter(option.value)}
                    >
                      <span>{option.label}</span>
                      <strong>{option.count}</strong>
                    </button>
                  ))}
                </div>
                <TextField
                  label="Search"
                  placeholder="Search graduate, email, competency..."
                  value={assessmentSearch}
                  onChange={(event) => setAssessmentSearch(event.target.value)}
                />
              </div>
              <div className="assessor-queue-layout">
                <div className="assessment-queue-list">
                  <div className="section-heading">
                    <strong>
                      {filteredAssessments.length} assessment
                      {filteredAssessments.length === 1 ? "" : "s"} found
                    </strong>
                    <span>Click a card to open the review workspace</span>
                  </div>
                  {filteredAssessments.length === 0 ? (
                    <EmptyState message="No assessments match the selected filter." />
                  ) : (
                    filteredAssessments.map((assessment) => {
                      const taskReview =
                        assessment.evidence.repositorySummary?.taskReview;
                      const isSelected = selected?._id === assessment._id;

                      return (
                        <button
                          className={`assessment-queue-card ${
                            isSelected ? "active" : ""
                          }`}
                          key={assessment._id}
                          type="button"
                          onClick={() => selectAssessmentForReview(assessment)}
                        >
                          <div className="queue-card-main">
                            <div>
                              <Badge tone="neutral">
                                {readableStatus(assessment.status)}
                              </Badge>
                              <h3>{assessment.competency.title}</h3>
                              <p>{assessment.graduate.name}</p>
                            </div>
                            <span>{formatDate(assessment.createdAt)}</span>
                          </div>
                          <div className="queue-card-metrics">
                            <span>
                              <strong>
                                {taskReview
                                  ? formatPercent(taskReview.score)
                                  : "Pending"}
                              </strong>
                              GitHub task
                            </span>
                            <span>
                              <strong>
                                {formatPercent(assessment.scores.quizScore)}
                              </strong>
                              Theory
                            </span>
                            <span>
                              <strong>
                                {formatPercent(assessment.scores.finalScore)}
                              </strong>
                              Final
                            </span>
                          </div>
                          <small>
                            {taskReview
                              ? `${taskReview.passedCount}/${taskReview.checklist.length} repository checks passed`
                              : "Repository checklist will appear after graduate review submission."}
                          </small>
                        </button>
                      );
                    })
                  )}
                </div>
                <aside className="assessment-selection-panel">
                  {selected ? (
                    <>
                      <span className="eyebrow">Selected review</span>
                      <h3>{selected.competency.title}</h3>
                      <p>
                        {selected.graduate.name} submitted this assessment on{" "}
                        {formatDate(selected.createdAt)}.
                      </p>
                      <div className="selection-metrics">
                        <span>
                          <strong>
                            {formatPercent(
                              selected.evidence.repositorySummary?.taskReview
                                ?.score,
                            )}
                          </strong>
                          GitHub task score
                        </span>
                        <span>
                          <strong>
                            {formatPercent(selected.scores.quizScore)}
                          </strong>
                          Theory score
                        </span>
                      </div>
                      <Button
                        onClick={() =>
                          document
                            .getElementById("assessment-review")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            })
                        }
                      >
                        Continue Review
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="eyebrow">No assessment selected</span>
                      <h3>Choose a submission</h3>
                      <p>
                        Select a card from the queue to inspect GitHub task and
                        theory evidence, verify authenticity, and approve the final
                        recommendation.
                      </p>
                    </>
                  )}
                </aside>
              </div>
            </div>
          )}
        </Card>
      ) : (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {role === "assessor" && selected && (
        <ReviewAssessmentPanel
          assessment={selected}
          key={selected._id}
          onClose={() => setSelected(null)}
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
  onClose,
  onReviewed,
}: {
  assessment: Assessment;
  token: string;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const theoryAnswers = assessment.evidence.theoryAnswers || [];
  const quizScore = assessment.scores.quizScore || 0;
  const [assessorComment, setAssessorComment] = useState("");
  const [message, setMessage] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [draftPreview, setDraftPreview] = useState<Awaited<
    ReturnType<typeof api.previewAssessmentRecommendation>
  > | null>(null);
  const [error, setError] = useState("");
  const [evidenceVerification, setEvidenceVerification] = useState({
    githubReviewed: false,
    practicalEvidenceReviewed: false,
    theoryReviewed: false,
    authenticityNotes: "",
  });
  const [draftStatus, setDraftStatus] = useState(
    "Loading Gemini draft recommendation...",
  );
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);

  const repositoryTaskReview = assessment.evidence.repositorySummary?.taskReview;
  const effectivePracticalScore =
    repositoryTaskReview?.score ?? assessment.scores.practicalTaskScore ?? 0;
  const previewScore = useMemo(
    () =>
      effectivePracticalScore * 0.7 +
      quizScore * 0.3,
    [effectivePracticalScore, quizScore],
  );
  const repositoryQuality =
    assessment.evidence.repositorySummary?.codeQualityScore || 0;
  const repositoryCompleteness =
    assessment.evidence.repositorySummary?.evidenceCompletenessScore || 0;
  const verificationCount = [
    evidenceVerification.githubReviewed,
    evidenceVerification.practicalEvidenceReviewed,
    evidenceVerification.theoryReviewed,
  ].filter(Boolean).length;

  async function loadGeminiDraft() {
    await Promise.resolve();
    setIsGeneratingDraft(true);
    setDraftStatus("Generating Gemini recommendation from performance data...");

    try {
      const draft = await api.previewAssessmentRecommendation(
        token,
        assessment._id,
        {
          practicalTaskScore: effectivePracticalScore,
          quizScore,
          assessorComment,
          evidenceVerification,
        },
      );

      setMessage(draft.recommendation.message);
      setActionItems(draft.recommendation.actionItems.join("\n"));
      setDraftPreview(draft);
      setDraftStatus(
        `${draft.recommendation.provider} recommendation loaded from ${draft.recommendation.model}`,
      );
    } catch (caughtError) {
      setDraftPreview(null);
      setDraftStatus(
        caughtError instanceof Error
          ? caughtError.message
          : "Gemini draft unavailable. Generate a Gemini recommendation before saving the review.",
      );
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      async function loadInitialGeminiDraft() {
        setIsGeneratingDraft(true);
        setDraftStatus("Generating Gemini recommendation from performance data...");

        try {
          const draft = await api.previewAssessmentRecommendation(
            token,
            assessment._id,
            {
              practicalTaskScore: effectivePracticalScore,
              quizScore,
              assessorComment: "",
              evidenceVerification: {
                githubReviewed: false,
                practicalEvidenceReviewed: false,
                theoryReviewed: false,
                authenticityNotes: "",
              },
            },
          );

          setMessage(draft.recommendation.message);
          setActionItems(draft.recommendation.actionItems.join("\n"));
          setDraftPreview(draft);
          setDraftStatus(
            `${draft.recommendation.provider} recommendation loaded from ${draft.recommendation.model}`,
          );
        } catch (caughtError) {
          setDraftPreview(null);
          setDraftStatus(
            caughtError instanceof Error
              ? caughtError.message
              : "Gemini draft unavailable. Generate a Gemini recommendation before saving the review.",
          );
        } finally {
          setIsGeneratingDraft(false);
        }
      }

      void loadInitialGeminiDraft();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [assessment._id, effectivePracticalScore, quizScore, token]);

  async function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!draftPreview) {
      setError(
        "Generate a Gemini recommendation before saving the review. Recommendations must come from Gemini performance analysis.",
      );
      return;
    }

    try {
      await api.reviewAssessment(token, assessment._id, {
        practicalTaskScore: effectivePracticalScore,
        quizScore,
        assessorComment,
        evidenceVerification,
        recommendation: {
          message,
          actionItems: actionItems
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          resources: draftPreview.recommendation.resources,
          geminiDraft: {
            message: draftPreview.recommendation.message,
            actionItems: draftPreview.recommendation.actionItems,
            resources: draftPreview.recommendation.resources,
            priority: draftPreview.recommendation.priority,
            provider: draftPreview.recommendation.provider,
            model: draftPreview.recommendation.model,
            prompt: draftPreview.recommendation.prompt,
            rawResponse: draftPreview.recommendation.rawResponse,
          },
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
    <section className="review-workspace" id="assessment-review">
      <div className="review-workspace-hero">
        <div>
          <span className="eyebrow">Assessment review</span>
          <h2>{assessment.competency.title}</h2>
          <p>
            Review the GitHub practical task, theory answers,
            and final recommendation before submitting the official gap result.
          </p>
          <div className="review-identity">
            <span>{assessment.graduate.name}</span>
            <span>{readableStatus(assessment.status)}</span>
            <span>Submitted {formatDate(assessment.createdAt)}</span>
          </div>
        </div>
        <div className="review-score-summary">
          <div>
            <span>GitHub task</span>
            <strong>
              {repositoryTaskReview
                ? formatPercent(repositoryTaskReview.score)
                : "Pending"}
            </strong>
          </div>
          <div>
            <span>Practical</span>
            <strong>{formatPercent(effectivePracticalScore)}</strong>
          </div>
          <div>
            <span>Theory</span>
            <strong>{formatPercent(quizScore)}</strong>
          </div>
          <div>
            <span>Final preview</span>
            <strong>{formatPercent(previewScore)}</strong>
          </div>
        </div>
      </div>
      <div className="review-nav-bar">
        <div>
          <a href="#submitted-evidence">Evidence</a>
          <a href="#score-summary">Scores</a>
          <a href="#evidence-verification">Verification</a>
          <a href="#review-recommendation">Recommendation</a>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Back to list
        </Button>
      </div>
      <div className="review-grid">
        <div className="evidence-box review-panel" id="submitted-evidence">
          <div className="review-section-title">
            <span>01</span>
            <div>
              <h3>Submitted evidence</h3>
              <p>Use these artifacts to confirm that the work is real and aligned with the selected practical task.</p>
            </div>
          </div>
          <div className="review-overview-grid">
            <div>
              <span>Repository quality</span>
              <strong>{formatPercent(repositoryQuality)}</strong>
              <ProgressBar value={repositoryQuality} />
            </div>
            <div>
              <span>Evidence completeness</span>
              <strong>{formatPercent(repositoryCompleteness)}</strong>
              <ProgressBar value={repositoryCompleteness} />
            </div>
            <div>
              <span>Theory answers</span>
              <strong>
                {theoryAnswers.length}/{assessment.competency.theoryQuestions?.length || theoryAnswers.length || 0}
              </strong>
              <small>Submitted responses</small>
            </div>
          </div>
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
                {assessment.evidence.repositorySummary?.ciRunFound && (
                  <div className="assessor-note">
                    <strong>GitHub Actions proof</strong>
                    <p>
                      Latest run:{" "}
                      {assessment.evidence.repositorySummary.ciRunName ||
                        "Workflow run"}
                      . Status:{" "}
                      {assessment.evidence.repositorySummary.ciRunStatus ||
                        "unknown"}
                      . Conclusion:{" "}
                      {assessment.evidence.repositorySummary.ciRunConclusion ||
                        "unknown"}
                      .
                    </p>
                    {assessment.evidence.repositorySummary.ciRunUrl && (
                      <a
                        href={assessment.evidence.repositorySummary.ciRunUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open GitHub Actions run
                      </a>
                    )}
                  </div>
                )}
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
                {assessment.evidence.repositorySummary?.taskReview && (
                  <div className="assessor-note">
                    <strong>Automatic task review</strong>
                        <p>
                          {
                            assessment.evidence.repositorySummary.taskReview
                              .summary
                          }
                        </p>
                        {assessment.evidence.repositorySummary.taskReview
                          .proofLevel && (
                          <p>
                            Proof level:{" "}
                            <strong>
                              {
                                assessment.evidence.repositorySummary.taskReview
                                  .proofLevel
                              }
                            </strong>
                          </p>
                        )}
                        {assessment.evidence.repositorySummary.taskReview
                          .implementationReview && (
                      <div className="assessor-note">
                        <strong>Implementation evidence</strong>
                        <p>
                          Source files reviewed:{" "}
                          {
                            assessment.evidence.repositorySummary.taskReview
                              .implementationReview.sourceFilesReviewed
                          }
                          . Implementation evidence score:{" "}
                          {formatPercent(
                            assessment.evidence.repositorySummary.taskReview
                              .implementationReview.implementationEvidenceScore ||
                              0,
                          )}
                          . Functional coverage:{" "}
                          {formatPercent(
                            assessment.evidence.repositorySummary.taskReview
                              .implementationReview.functionalCoverageRate ||
                              0,
                          )}
                          .
                        </p>
                        <p>
                          Detected:{" "}
                          {assessment.evidence.repositorySummary.taskReview
                            .implementationReview.detectedFunctionalAreas
                            ?.length
                            ? assessment.evidence.repositorySummary.taskReview.implementationReview.detectedFunctionalAreas.join(
                                ", ",
                              )
                            : "No strong implementation signals detected."}
                        </p>
                        {assessment.evidence.repositorySummary.taskReview
                          .implementationReview.missingFunctionalAreas
                          ?.length ? (
                          <p>
                            Missing:{" "}
                            {assessment.evidence.repositorySummary.taskReview.implementationReview.missingFunctionalAreas.join(
                              ", ",
                            )}
                          </p>
                        ) : null}
                      </div>
                    )}
                    <div className="task-checklist">
                      {assessment.evidence.repositorySummary.taskReview.checklist.map(
                        (item) => (
                          <div
                            className={`task-check ${
                              item.passed ? "passed" : "failed"
                            }`}
                            key={item.key}
                          >
                            <span>{item.passed ? "Passed" : "Failed"}</span>
                            <div>
                              <strong>{item.label}</strong>
                              <p>{item.evidence}</p>
                            </div>
                            <em>{item.weight} pts</em>
                          </div>
                        ),
                      )}
                    </div>
                    {assessment.evidence.repositorySummary.taskReview
                      .competencyScores && (
                      <div className="assessor-note">
                        <strong>Competency score breakdown</strong>
                        <div className="result-grid">
                          {Object.entries(
                            assessment.evidence.repositorySummary.taskReview
                              .competencyScores,
                          ).map(([key, value]) => (
                            <div key={key}>
                              <small>{key}</small>
                              <strong>{formatPercent(value || 0)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {assessment.evidence.repositorySummary.taskReview
                      .recommendations?.length ? (
                      <div className="assessor-note warning-note">
                        <strong>Repository recommendations</strong>
                        <ul>
                          {assessment.evidence.repositorySummary.taskReview.recommendations.map(
                            (item) => (
                              <li key={item}>{item}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}
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
        </div>
        <form className="form-stack review-panel review-form-panel" onSubmit={handleReview}>
          {error && <Alert type="error">{error}</Alert>}
          <div className="recommendation-approval-panel" id="review-recommendation">
            <div className="review-section-title">
              <span>03</span>
              <div>
                <h3>Approve Gemini recommendation</h3>
                <p>Gemini uses the GitHub task score, theory score, benchmark, gap level, and assessor notes to draft practical guidance.</p>
              </div>
            </div>
            <div className="recommendation-action-row">
              <Alert type={draftPreview ? "success" : "info"}>
                {draftStatus}
              </Alert>
              <Button
                disabled={isGeneratingDraft}
                variant="secondary"
                onClick={() => void loadGeminiDraft()}
              >
                {isGeneratingDraft
                  ? "Generating..."
                  : "Generate Gemini recommendation"}
              </Button>
            </div>
            {draftPreview ? (
              <div className="gemini-recommendation-card">
                <div className="gemini-recommendation-header">
                  <div>
                    <span className="eyebrow">Gemini performance-based draft</span>
                    <strong>{draftPreview.recommendation.message}</strong>
                  </div>
                  <Badge tone="role">
                    {draftPreview.recommendation.priority} priority
                  </Badge>
                </div>
                <div className="gemini-performance-grid">
                  <span>
                    <strong>{formatPercent(effectivePracticalScore)}</strong>
                    GitHub task
                  </span>
                  <span>
                    <strong>{formatPercent(quizScore)}</strong>
                    Theory
                  </span>
                  <span>
                    <strong>{formatPercent(draftPreview.finalScore)}</strong>
                    Final score
                  </span>
                  <span>
                    <strong>{formatPercent(draftPreview.skillGap)}</strong>
                    Skill gap
                  </span>
                </div>
                <div className="compact-meta recommendation-meta">
                  <Badge tone="neutral">{draftPreview.gapLevel}</Badge>
                  <span>
                    RTB benchmark: {formatPercent(draftPreview.benchmarkScore)}
                  </span>
                  <span>
                    Source: {draftPreview.recommendation.provider} /{" "}
                    {draftPreview.recommendation.model}
                  </span>
                </div>
                {draftPreview.recommendation.actionItems.length > 0 && (
                  <div className="gemini-list-block">
                    <strong>Suggested action items</strong>
                    <ul>
                      {draftPreview.recommendation.actionItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {draftPreview.recommendation.resources.length > 0 && (
                  <div className="gemini-list-block">
                    <strong>Suggested resources</strong>
                    <ul>
                      {draftPreview.recommendation.resources.map((resource) => (
                        <li key={resource}>{resource}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="gemini-recommendation-card muted">
                <span className="eyebrow">Gemini draft</span>
                <strong>Recommendation draft is not available yet.</strong>
                <p>
                  Confirm Gemini configuration and assessment scores, then use the
                  generate button again. The review cannot be saved until Gemini
                  returns a recommendation.
                </p>
              </div>
            )}
            <TextArea
              label="Approved recommendation message"
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
          </div>
          <div className="review-section-title" id="score-summary">
            <span>02</span>
            <div>
              <h3>Assessment scores</h3>
              <p>The system assesses only GitHub practical task and theory/quiz. Practical/GitHub carries 70% and theory/quiz carries 30%.</p>
            </div>
          </div>
          <div className="assessment-score-cards">
            <div>
              <span>GitHub practical task</span>
              <strong>{formatPercent(effectivePracticalScore)}</strong>
              <p>
                {repositoryTaskReview
                  ? `${repositoryTaskReview.passedCount}/${repositoryTaskReview.checklist.length} repository checks passed.`
                  : "No repository task review score is available."}
              </p>
            </div>
            <div>
              <span>Theory / quiz</span>
              <strong>{formatPercent(quizScore)}</strong>
              <p>Calculated from submitted theory answers.</p>
            </div>
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
          <div className="assessor-evidence-section" id="evidence-verification">
            <div className="section-heading">
              <strong>Evidence verification</strong>
              <span>{verificationCount}/3 checked</span>
            </div>
            <div className="check-grid">
              {[
                ["githubReviewed", "GitHub project reviewed"],
                ["practicalEvidenceReviewed", "Practical evidence reviewed"],
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
          <div className="review-submit-bar">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!draftPreview || isGeneratingDraft} type="submit">
              Save Review
            </Button>
          </div>
        </form>
      </div>
    </section>
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
                  <div className="assessor-note">
                    <strong>Assessment score breakdown</strong>
                    <ul>
                      <li>
                        GitHub practical task:{" "}
                        {formatPercent(assessment.scores.practicalTaskScore)}
                      </li>
                      <li>
                        Theory / quiz: {formatPercent(assessment.scores.quizScore)}
                      </li>
                    </ul>
                  </div>
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
      isLearnerRole(role) ? undefined : graduateId,
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
        {!isLearnerRole(role) && (
          <TextField
            label="Assessment user ID"
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
      const scoreBreakdown = `
        <li>GitHub practical task: ${escapeHtml(formatPercent(assessment.scores.practicalTaskScore))}</li>
        <li>Theory / quiz: ${escapeHtml(formatPercent(assessment.scores.quizScore))}</li>
      `;
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
        <h4>Assessment score breakdown</h4>
        <ul>${scoreBreakdown}</ul>
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

  return <GraduateNotificationsPage token={token} />;
}

function GraduateNotificationsPage({ token }: { token: string }) {
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
            <option value="normal_user">Normal Users</option>
            <option value="organization_user">Organization Users</option>
            <option value="org_admin">Organization Admins</option>
            <option value="admin">Admins</option>
            <option value="super_admin">Super Admins</option>
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

function organizationName(user: User) {
  if (user.organization && typeof user.organization === "object") {
    return user.organization.name;
  }

  return user.institution || "N/A";
}

export function UsersPage({ token, role }: { token: string; role: Role }) {
  const { data, isLoading, error, refresh } = useAsyncData(
    () => api.users(token),
    [] as User[],
  );
  const {
    data: organizations,
    error: organizationError,
    refresh: refreshOrganizations,
  } = useAsyncData(() => api.organizations(token), [] as Organization[]);
  const defaultRole =
    role === "super_admin"
      ? "admin"
      : role === "admin"
        ? "org_admin"
        : "organization_user";
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: defaultRole as Role,
    organizationId: "",
  });
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const creatableRoles =
    role === "super_admin"
      ? (["admin"] as Role[])
      : role === "admin"
        ? (["org_admin"] as Role[])
        : (["organization_user"] as Role[]);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setFormError("");

    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError("Name, email, and password are required.");
      return;
    }

    if (["organization_user", "org_admin"].includes(form.role) && role !== "org_admin" && !form.organizationId) {
      setFormError("Select an organization for organization users and organization admins.");
      return;
    }

    setIsSaving(true);
    try {
      await api.createUser(token, {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        organizationId: form.organizationId || undefined,
      });
      setForm({
        name: "",
        email: "",
        password: "",
        role: defaultRole as Role,
        organizationId: "",
      });
      setMessage("User account created successfully.");
      await refresh();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error ? caughtError.message : "Failed to create user",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetTemporaryPassword(user: User) {
    setMessage("");
    setFormError("");

    try {
      const result = await api.resetUserTemporaryPassword(token, user.id);
      setMessage(
        `Temporary password for ${result.user.name}: ${result.temporaryPassword}. It expires on ${formatDate(result.expiresAt)} and must be changed after login.`,
      );
      await refresh();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to reset temporary password",
      );
    }
  }

  if (isLoading) return <LoadingState message="Loading users..." />;

  return (
    <section className="page-stack">
      <PageHeader
        title="User Management"
        description={
          role === "admin"
            ? "Create organization admin accounts only."
            : role === "super_admin"
              ? "Create admin accounts. Admins create organization admins, and organization admins create organization users."
              : "Create organization users for your own institution only."
        }
        onRefresh={refresh}
      />
      {error && <Alert type="error">{error}</Alert>}
      {organizationError && role === "admin" && <Alert type="error">{organizationError}</Alert>}
      {message && <Alert type="success">{message}</Alert>}
      {formError && <Alert type="error">{formError}</Alert>}
      <Card title="Create user account">
        <Alert type="info">
          Normal user self-registration is public from the homepage. Admin,
          super admin, organization admin, and organization user accounts are
          protected and must be created by an authorized administrator.
        </Alert>
        <form className="form-grid" onSubmit={handleCreateUser}>
          <TextField
            label="Full name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
          <TextField
            label="Temporary password"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />
          <SelectField
            label="Role"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
          >
            {creatableRoles.map((item) => (
              <option key={item} value={item}>
                {roleLabel(item)}
              </option>
            ))}
          </SelectField>
          {role !== "org_admin" && ["organization_user", "org_admin"].includes(form.role) && (
            <SelectField
              label="Organization"
              value={form.organizationId}
              onChange={(event) =>
                setForm({ ...form, organizationId: event.target.value })
              }
              required
            >
              <option value="">Select organization</option>
              {organizations
                .filter((organization) => organization.status !== "inactive")
                .map((organization) => (
                  <option key={organization._id} value={organization._id}>
                    {organization.name}
                  </option>
                ))}
            </SelectField>
          )}
          <div className="form-actions">
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Creating user..." : "Create user"}
            </Button>
            {role === "admin" && (
              <Button variant="secondary" onClick={refreshOrganizations}>
                Refresh organizations
              </Button>
            )}
          </div>
        </form>
      </Card>
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
                  <th>Organization</th>
                  <th>Status</th>
                  <th>Security</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{roleLabel(user.role)}</td>
                    <td>{organizationName(user)}</td>
                    <td>{user.isActive === false ? "Inactive" : "Active"}</td>
                    <td>
                      {user.mustChangePassword ? "Temporary password" : "Password set"}
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        onClick={() => void handleResetTemporaryPassword(user)}
                      >
                        Reset password
                      </Button>
                    </td>
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

export function OrganizationsPage({ token }: { token: string }) {
  const { data, isLoading, error, refresh } = useAsyncData(
    () => api.organizations(token),
    [] as Organization[],
  );
  const [form, setForm] = useState({
    name: "",
    district: "Kicukiro",
    type: "tvet_institution" as Organization["type"],
    contactEmail: "",
    phone: "",
    address: "",
  });
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setFormError("");

    if (!form.name.trim()) {
      setFormError("Organization name is required.");
      return;
    }

    setIsSaving(true);
    try {
      await api.createOrganization(token, {
        name: form.name.trim(),
        district: form.district.trim(),
        type: form.type,
        contactEmail: form.contactEmail.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      });
      setForm({
        name: "",
        district: "Kicukiro",
        type: "tvet_institution",
        contactEmail: "",
        phone: "",
        address: "",
      });
      setMessage("Organization created successfully.");
      await refresh();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to create organization",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading organizations..." />;

  return (
    <section className="page-stack">
      <PageHeader
        title="Organizations"
        description="Create and manage organizations that own organization users and organization admins."
        onRefresh={refresh}
      />
      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}
      {formError && <Alert type="error">{formError}</Alert>}
      <Card title="Create organization">
        <form className="form-grid" onSubmit={handleCreateOrganization}>
          <TextField
            label="Organization name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
          <TextField
            label="District"
            value={form.district}
            onChange={(event) => setForm({ ...form, district: event.target.value })}
          />
          <SelectField
            label="Organization type"
            value={form.type}
            onChange={(event) =>
              setForm({ ...form, type: event.target.value as Organization["type"] })
            }
          >
            <option value="tvet_institution">TVET Institution</option>
            <option value="training_center">Training Center</option>
            <option value="other">Other</option>
          </SelectField>
          <TextField
            label="Contact email"
            type="email"
            value={form.contactEmail}
            onChange={(event) =>
              setForm({ ...form, contactEmail: event.target.value })
            }
          />
          <TextField
            label="Phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <TextField
            label="Address"
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
          <div className="form-actions">
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Creating organization..." : "Create organization"}
            </Button>
          </div>
        </form>
      </Card>
      <Card title="Registered organizations">
        {data.length === 0 ? (
          <EmptyState message="No organizations found." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>District</th>
                  <th>Type</th>
                  <th>Contact</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((organization) => (
                  <tr key={organization._id}>
                    <td>{organization.name}</td>
                    <td>{organization.district || "N/A"}</td>
                    <td>{organization.type || "N/A"}</td>
                    <td>{organization.contactEmail || organization.phone || "N/A"}</td>
                    <td>{organization.status || "active"}</td>
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
    practicalTaskTestCommand: "",
    practicalTaskTestFilePath: "",
    practicalTaskTestFileContent: "",
    theoryQuestion: "",
    theoryOptions: "",
    theoryCorrectAnswer: "",
  });
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function resetCompetencyForm() {
    setForm({
      code: "",
      title: "",
      category: "",
      description: "",
      expectedEvidence: "",
      practicalTaskTitle: "",
      practicalTaskInstructions: "",
      practicalTaskDeliverables: "",
      practicalTaskTestCommand: "",
      practicalTaskTestFilePath: "",
      practicalTaskTestFileContent: "",
      theoryQuestion: "",
      theoryOptions: "",
      theoryCorrectAnswer: "",
    });
  }

  function validateCompetencyForm() {
    const code = form.code.trim();
    const title = form.title.trim();
    const category = form.category.trim();
    const hasPracticalTask = Boolean(form.practicalTaskTitle.trim());
    // Hidden instructor tests are optional, but partial configuration would
    // make repository execution ambiguous, so require all three fields together.
    const hasAnyInstructorTestField = Boolean(
      form.practicalTaskTestCommand.trim() ||
        form.practicalTaskTestFilePath.trim() ||
        form.practicalTaskTestFileContent.trim(),
    );
    const hasCompleteInstructorTest =
      Boolean(form.practicalTaskTestCommand.trim()) &&
      Boolean(form.practicalTaskTestFilePath.trim()) &&
      Boolean(form.practicalTaskTestFileContent.trim());
    const hasTheoryQuestion = Boolean(form.theoryQuestion.trim());
    const theoryOptions = form.theoryOptions
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean);

    if (!code || !title || !category) {
      return "Code, title, and category are required.";
    }

    if (hasPracticalTask && !form.practicalTaskInstructions.trim()) {
      return "Task instructions are required when a practical task is added.";
    }

    if (hasAnyInstructorTestField && !hasCompleteInstructorTest) {
      return "Instructor test command, file path, and file content must all be provided together.";
    }

    if (hasTheoryQuestion && !form.theoryCorrectAnswer.trim()) {
      return "Correct answer is required when a theory question is added.";
    }

    if (hasTheoryQuestion && theoryOptions.length < 2) {
      return "Add at least two multiple-choice options for the theory question.";
    }

    if (
      hasTheoryQuestion &&
      !theoryOptions.some(
        (option) =>
          option.toLowerCase() === form.theoryCorrectAnswer.trim().toLowerCase(),
      )
    ) {
      return "Correct answer must match one of the multiple-choice options.";
    }

    return "";
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setFormError("");

    const validationMessage = validateCompetencyForm();
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setIsSaving(true);

    try {
      const theoryOptions = form.theoryOptions
        .split("\n")
        .map((option) => option.trim())
        .filter(Boolean);

      await api.createCompetency(token, {
        code: form.code.trim(),
        title: form.title.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        expectedEvidence: form.expectedEvidence.trim(),
        practicalTasks: form.practicalTaskTitle.trim()
          ? [
              {
                title: form.practicalTaskTitle.trim(),
                instructions: form.practicalTaskInstructions.trim(),
                deliverables: form.practicalTaskDeliverables.trim(),
                estimatedMinutes: 60,
                maxScore: 100,
                // These hidden tests are injected into a graduate repository
                // during review to verify the exact practical task behavior.
                automatedTestCommand: form.practicalTaskTestCommand.trim(),
                automatedTestFiles:
                  form.practicalTaskTestFilePath.trim() &&
                  form.practicalTaskTestFileContent.trim()
                    ? [
                        {
                          path: form.practicalTaskTestFilePath.trim(),
                          content: form.practicalTaskTestFileContent,
                        },
                      ]
                    : [],
              },
            ]
          : [],
        theoryQuestions: form.theoryQuestion.trim()
          ? [
              {
                question: form.theoryQuestion.trim(),
                type: "multiple_choice",
                options: theoryOptions,
                correctAnswer: form.theoryCorrectAnswer.trim(),
                points: 1,
              },
            ]
          : [],
      });
      resetCompetencyForm();
      setMessage("Competency created successfully.");
      await refresh();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to create competency",
      );
    } finally {
      setIsSaving(false);
    }
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
      {formError && <Alert type="error">{formError}</Alert>}
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
            <p className="form-help">
              Add a practical GitHub task and optional hidden instructor tests.
              Hidden tests make repository scores more realistic because they
              prove whether submitted code solves the task.
            </p>
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
              <TextField
                label="Instructor test command"
                value={form.practicalTaskTestCommand}
                onChange={(event) =>
                  setForm({
                    ...form,
                    practicalTaskTestCommand: event.target.value,
                  })
                }
                placeholder="npm test -- --runInBand tests/instructor-task.test.js"
              />
              <TextField
                label="Instructor test file path"
                value={form.practicalTaskTestFilePath}
                onChange={(event) =>
                  setForm({
                    ...form,
                    practicalTaskTestFilePath: event.target.value,
                  })
                }
                placeholder="tests/instructor-task.test.js"
              />
              <div className="full-span">
                <TextArea
                  label="Instructor test file content"
                  rows={8}
                  value={form.practicalTaskTestFileContent}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      practicalTaskTestFileContent: event.target.value,
                    })
                  }
                  placeholder="Add Jest, Supertest, or Playwright tests that prove the practical task works."
                />
              </div>
            </div>
          </div>
          <div className="full-span form-subsection">
            <h3>Theory question</h3>
            <p className="form-help">
              Add at least two options and make the correct answer match one
              option exactly.
            </p>
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
          <div className="full-span button-row">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving competency..." : "Add Competency"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                resetCompetencyForm();
                setFormError("");
                setMessage("");
              }}
              disabled={isSaving}
            >
              Clear Form
            </Button>
          </div>
        </form>
      </Card>
      <Card title="Current competencies">
        {data.length === 0 ? (
          <EmptyState message="No competencies have been added yet." />
        ) : (
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
                {data.map((item) => {
                  const taskCount = item.practicalTasks?.length || 0;
                  const hiddenTestCount =
                    item.practicalTasks?.filter(
                      (task) =>
                        task.automatedTestCommand ||
                        task.automatedTestFiles?.length,
                    ).length || 0;

                  return (
                    <tr key={item._id}>
                      <td>{item.code}</td>
                      <td>{item.title}</td>
                      <td>{item.category}</td>
                      <td>{item.expectedEvidence || "N/A"}</td>
                      <td>
                        {taskCount} GitHub task(s),{" "}
                        {item.theoryQuestions?.length || 0} theory question(s)
                        {hiddenTestCount > 0
                          ? `, ${hiddenTestCount} hidden test set(s)`
                          : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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

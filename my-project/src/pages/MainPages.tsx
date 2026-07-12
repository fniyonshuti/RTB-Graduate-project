import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  FileText,
  IdCard,
  MapPin,
  Phone,
  School,
  UserRound,
} from "lucide-react";
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
  ReadMoreText,
  SelectField,
  StatCard,
  TextArea,
  TextField,
  BarChartComponent,
  LineChartComponent,
  PieChartComponent,
  Users,
  BarChart3,
  TrendingUp,
  Zap,
  Target,
  ClipboardCheck,
  Award,
  AlertTriangle,
  Gauge,
  Activity,
} from "../components/common";
import type {
  Assessment,
  Benchmark,
  Competency,
  PracticalTask,
  DashboardData,
  GraduateProfile,
  NotificationItem,
  Organization,
  Recommendation,
  LearningResource,
  RepositoryTaskReview,
  Report,
  Role,
  User,
} from "../types";
import { formatDate, formatPercent, readableStatus } from "../utils/gapLevels";
import { isLearnerRole, roleLabel } from "../utils/roles";
import { GITHUB_PLACEHOLDER } from "../constants/github";

type PageProps = {
  token: string;
  role: Role;
};

type DashboardPageProps = PageProps & {
  onNavigate: (view: ViewKey) => void;
};

type ChartItem = Record<string, string | number>;

type AsyncState<T> = {
  data: T;
  isLoading: boolean;
  error: string;
};


function normalizeSearchValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(normalizeSearchValue).join(" ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(normalizeSearchValue)
      .join(" ");
  }
  return String(value).toLowerCase();
}

function matchesSearchTerm(query: string, ...values: unknown[]) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return values.some((value) => normalizeSearchValue(value).includes(normalizedQuery));
}

function uniqueFilterOptions(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));
}

function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  totalCount,
  filteredCount,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  totalCount: number;
  filteredCount: number;
  children?: ReactNode;
}) {
  return (
    <div className="list-toolbar" role="search" aria-label="List search and filters">
      <TextField
        label="Search"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      {children && <div className="list-toolbar__filters">{children}</div>}
      <span className="list-toolbar__count">
        Showing {filteredCount} of {totalCount}
      </span>
    </div>
  );
}


function resourceLink(resource: LearningResource) {
  if (resource.url) return resource.url;
  if (resource.searchQuery) {
    return `https://www.google.com/search?q=${encodeURIComponent(resource.searchQuery)}`;
  }
  return "";
}

function fallbackResourceLink(resource: string) {
  const directUrl = resource.match(/https?:\/\/[^\s)]+/i)?.[0];
  if (directUrl) return directUrl;
  return `https://www.google.com/search?q=${encodeURIComponent(resource)}`;
}

function LearningResourceCards({
  resources = [],
  fallback = [],
}: {
  resources?: LearningResource[];
  fallback?: string[];
}) {
  const hasStructuredResources = resources.length > 0;

  if (!hasStructuredResources && fallback.length === 0) return null;

  return (
    <div className="learning-resource-list">
      {hasStructuredResources
        ? resources.map((resource) => {
            const href = resourceLink(resource);
            return (
              <article
                className="learning-resource-card"
                key={`${resource.type}-${resource.title}-${resource.url || resource.searchQuery}`}
              >
                <div className="learning-resource-card__header">
                  <Badge tone="neutral">{resource.type || "resource"}</Badge>
                  {resource.provider && <span>{resource.provider}</span>}
                </div>
                <strong>{resource.title}</strong>
                {resource.skillArea && (
                  <span className="compact-muted">{resource.skillArea}</span>
                )}
                {resource.reason && <ReadMoreText text={resource.reason} limit={130} />}
                {href && (
                  <a className="resource-link" href={href} target="_blank" rel="noreferrer">
                    {resource.url ? "Open resource" : "Search resource"}
                  </a>
                )}
              </article>
            );
          })
        : fallback.map((resource) => {
            const href = fallbackResourceLink(resource);
            return (
              <article className="learning-resource-card" key={resource}>
                <div className="learning-resource-card__header">
                  <Badge tone="neutral">resource</Badge>
                  <span>Recommended</span>
                </div>
                <ReadMoreText text={resource} limit={160} />
                <a className="resource-link" href={href} target="_blank" rel="noreferrer">
                  Open resource
                </a>
              </article>
            );
          })}
    </div>
  );
}


type RepositoryChecklistRow = RepositoryTaskReview["checklist"][number];

function RepositoryChecklistTable({ checklist }: { checklist: RepositoryChecklistRow[] }) {
  if (!checklist.length) return null;

  return (
    <div className="repository-checklist-result" aria-label="Repository checklist result">
      <table>
        <thead>
          <tr>
            <th>Checklist</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {checklist.map((item) => (
            <tr className={item.passed ? "passed" : "failed"} key={item.key}>
              <td>
                <strong>{item.label}</strong>
              </td>
              <td>
                <Badge tone={item.passed ? "success" : "danger"}>
                  {item.passed ? "Passed" : "Failed"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
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

function dashboardChartList(data: DashboardData, key: string) {
  return dashboardList<ChartItem>(data, key);
}

function dashboardRecord(data: DashboardData, key: string) {
  const value = data[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, number>)
    : {};
}

function gapDistributionChart(data: DashboardData) {
  const distribution = dashboardRecord(data, "gapDistribution");
  const orderedLevels = [
    "No Gap",
    "Very Low Gap",
    "Low Gap",
    "Moderate Gap",
    "High Gap",
    "Not Reviewed",
  ];

  return orderedLevels
    .map((level) => ({
      name: level,
      value: Number(distribution[level] || 0),
    }))
    .filter((item) => item.value > 0);
}

function reviewedAssessmentChart(data: DashboardData, assessments: Assessment[]) {
  const apiChart = dashboardChartList(data, "reviewedCompetencyScores");

  if (apiChart.length > 0) return apiChart;

  return assessments
    .filter((assessment) => assessment.status === "reviewed")
    .map((assessment) => ({
      name:
        assessment.competency?.code ||
        assessment.competency?.title?.slice(0, 14) ||
        "Competency",
      score: Number(assessment.scores?.finalScore || 0),
      gap: Number(assessment.skillGap || 0),
    }));
}

function assessmentStatusChart(data: DashboardData, assessments: Assessment[]) {
  const apiChart = dashboardChartList(data, "assessmentStatusDistribution");

  if (apiChart.length > 0) {
    return apiChart.map((item) => ({
      ...item,
      name:
        typeof item.name === "string"
          ? readableStatus(item.name as Assessment["status"])
          : item.name,
    }));
  }

  const totals = assessments.reduce<Record<string, number>>((summary, item) => {
    const status = readableStatus(item.status);
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});

  return Object.entries(totals).map(([name, value]) => ({ name, value }));
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

  const totalUsers = dashboardNumber(data, "totalGraduates");
  const orgUsers = dashboardNumber(data, "totalOrganizationUsers");
  const orgAdmins = dashboardNumber(data, "totalOrganizationAdmins");
  const totalCompetencies = dashboardNumber(data, "totalCompetencies");
  const avgGap = formatPercent(dashboardNumber(data, "averageSkillGap"));
  const gapChartData = gapDistributionChart(data);
  const assessmentStatusData = assessmentStatusChart(data, []);
  const competencyScoreData = dashboardChartList(data, "scoreByCompetency");
  const benchmarkCoverageData = dashboardChartList(data, "benchmarkCoverage");
  const roleDistributionData = dashboardChartList(data, "roleDistribution");
  const isOrganizationDashboard = role === "org_admin";

  const cards = [
    {
      label: isOrganizationDashboard ? "Organization Users" : "Total Users",
      value: totalUsers,
      icon: <Users size={24} />,
      tone: "blue" as const,
    },
    {
      label: "Organization Users",
      value: orgUsers,
      icon: <ClipboardCheck size={24} />,
      tone: "green" as const,
    },
    { label: "Organization Admins", value: orgAdmins, icon: <Zap size={24} />, tone: "slate" as const },
    {
      label: "Active Competencies",
      value: totalCompetencies,
      icon: <BarChart3 size={24} />,
      tone: "slate" as const,
    },
    {
      label: "Average Skill Gap",
      value: avgGap,
      icon: <Target size={24} />,
      helper: dashboardText(data, "overallGapLevel"),
      tone: "amber" as const,
    },
  ];

  return (
    <section className="page-stack">
      <PageHeader
        title={`${roleLabel(role)} Dashboard`}
        description={
          isOrganizationDashboard
            ? "A scoped overview of users, assessments, gaps, and reports for your organization only."
            : "A clear overview of assessment progress, scores, gaps, and action areas."
        }
        onRefresh={refresh}
      />
      {error && <Alert type="error">{error}</Alert>}
      <div className="stat-grid">
        {cards.map(({ label, value, icon, helper, tone }) => (
          <StatCard
            helper={helper}
            key={label}
            label={label}
            value={value}
            icon={icon}
            tone={tone}
          />
        ))}
      </div>

      <div className="analytics-grid">
        <Card
          title={isOrganizationDashboard ? "Organization User Composition" : "User Composition"}
          icon={<Users size={20} />}
        >
          {roleDistributionData.length === 0 ? (
            <EmptyState message="User composition appears after accounts are created." />
          ) : (
            <PieChartComponent
              data={roleDistributionData}
              dataKey="value"
              nameKey="name"
              colors={["#0077B6", "#10b981", "#1f2937", "#0077B6", "#34d399", "#0077B6", "#6ee7b7"]}
            />
          )}
        </Card>

        <Card title="Gap Distribution" icon={<Target size={20} />}>
          {gapChartData.length === 0 ? (
            <EmptyState message="Gap distribution appears after assessments are reviewed." />
          ) : (
            <PieChartComponent
              data={gapChartData}
              dataKey="value"
              nameKey="name"
              colors={["#10b981", "#34d399", "#0077B6", "#0077B6", "#1f2937", "#64748b"]}
            />
          )}
        </Card>

        <Card
          title="Assessment Status"
          icon={<BarChart3 size={20} />}
        >
          {assessmentStatusData.length === 0 ? (
            <EmptyState message="Assessment status chart appears after users submit assessments." />
          ) : (
            <BarChartComponent
              data={assessmentStatusData}
              dataKey="value"
              xAxisKey="name"
              color="#0077B6"
            />
          )}
        </Card>
      </div>

      <div className="analytics-grid">
        <Card title="Average Score by Competency" icon={<TrendingUp size={20} />}>
          {competencyScoreData.length === 0 ? (
            <EmptyState message="Competency score charts appear after reviewed assessments exist." />
          ) : (
            <BarChartComponent
              data={competencyScoreData}
              dataKey="score"
              xAxisKey="name"
              color="#10b981"
            />
          )}
        </Card>

        <Card title="Average Gap by Competency" icon={<Target size={20} />}>
          {competencyScoreData.length === 0 ? (
            <EmptyState message="Competency gap charts appear after reviewed assessments exist." />
          ) : (
            <LineChartComponent
              data={competencyScoreData}
              dataKey="gap"
              xAxisKey="name"
              color="#1f2937"
            />
          )}
        </Card>

        <Card title="Benchmark Coverage" icon={<Gauge size={20} />}>
          {benchmarkCoverageData.length === 0 ? (
            <EmptyState message="Benchmark coverage appears after competencies and benchmarks are added." />
          ) : (
            <PieChartComponent
              data={benchmarkCoverageData}
              dataKey="count"
              nameKey="name"
              colors={["#10b981", "#1f2937"]}
            />
          )}
        </Card>
      </div>

      <Card title="Assessment Engine" icon={<Zap size={20} />}>
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
  const scoreChartData = reviewedAssessmentChart(data, recentAssessments);
  const gapChartData = dashboardChartList(data, "skillGapByCompetency");
  const statusChartData = assessmentStatusChart(data, recentAssessments);
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
          icon={<Award size={24} />}
          tone="blue"
        />
        <StatCard
          helper={dashboardText(data, "overallGapLevel")}
          label="Average Skill Gap"
          value={formatPercent(averageGap)}
          icon={<Gauge size={24} />}
          tone="amber"
        />
        <StatCard
          helper={`${assessmentsSubmitted} submitted`}
          label="Competencies Reviewed"
          value={competenciesAssessed}
          icon={<ClipboardCheck size={24} />}
          tone="green"
        />
        <StatCard
          helper={
            highGapCount > 0 ? "Needs urgent practice" : "No urgent gaps found"
          }
          label="High Gap Areas"
          value={highGapCount}
          icon={<AlertTriangle size={24} />}
          tone={highGapCount > 0 ? "red" : "slate"}
        />
      </div>

      <div className="analytics-grid">
        <Card title="Reviewed Competency Scores" icon={<TrendingUp size={20} />}>
          {scoreChartData.length === 0 ? (
            <EmptyState message="Reviewed score charts appear after your first completed assessment." />
          ) : (
            <BarChartComponent
              data={scoreChartData}
              dataKey="score"
              xAxisKey="name"
              color="#0077B6"
            />
          )}
        </Card>

        <Card title="Skill Gap by Competency" icon={<Target size={20} />}>
          {(gapChartData.length || scoreChartData.length) === 0 ? (
            <EmptyState message="Skill gap chart appears after assessor review." />
          ) : (
            <LineChartComponent
              data={gapChartData.length > 0 ? gapChartData : scoreChartData}
              dataKey="gap"
              xAxisKey="name"
              color="#f59e0b"
            />
          )}
        </Card>

        <Card title="Assessment Status" icon={<Activity size={20} />}>
          {statusChartData.length === 0 ? (
            <EmptyState message="Assessment status chart appears after submissions." />
          ) : (
            <PieChartComponent
              data={statusChartData}
              dataKey="value"
              nameKey="name"
              colors={["#0077B6", "#f59e0b", "#10b981", "#64748b"]}
            />
          )}
        </Card>
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
          <div className="workflow-list dashboard-workflow-list">
            <WorkflowStep
              label="1"
              text="Select an RTB-aligned ICT competency."
            />
            <WorkflowStep
              label="2"
              text="Submit GitHub practical evidence repository and theory answers."
            />
            <WorkflowStep
              label="3"
              text="The system reviews the GitHub repository and scores theory evidence."
            />
            <WorkflowStep
              label="4"
              text="The system calculates skill gap, classifies gap level, generates Gemini recommendations, notifies the user, and generates the report."
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
                <div className="compact-row assessment-activity-row" key={assessment._id}>
                  <div className="assessment-activity-main">
                    <strong>{assessment.competency.title}</strong>
                    <span>{readableStatus(assessment.status)}</span>
                  </div>
                  <div className="compact-meta assessment-activity-meta">
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
                  <ReadMoreText text={recommendation.message} limit={150} />
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
      <ReadMoreText text={text} limit={130} />
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
  const {
    data: organizations,
    isLoading: isLoadingOrganizations,
    error: organizationLoadError,
  } = useAsyncData(() => api.publicOrganizations(), [] as Organization[]);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const profileCompletion = [
    profile.registrationNumber,
    profile.phone,
    profile.gender,
    profile.district,
    profile.sector,
    profile.institution,
    profile.program,
    profile.graduationYear,
    profile.specialization,
    profile.bio,
  ].filter((value) => String(value || "").trim().length > 0).length;
  const completionPercent = Math.round((profileCompletion / 10) * 100);
  const displayProgram = profile.program || "ICT TVET graduate";
  const displayInstitution = profile.institution || "Organisation not selected";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setFormError("");
    setIsSaving(true);

    try {
      const savedProfile = await api.saveProfile(token, profile);
      setProfile(savedProfile);
      setMessage("Profile saved successfully.");
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Profile could not be saved. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="page-stack profile-page">
      <PageHeader
        title="User Profile"
        description="Manage the academic, contact, organisation, and program details used in competency assessments and reports."
      />
      {error && <Alert type="error">{error}</Alert>}
      {formError && <Alert type="error">{formError}</Alert>}
      {organizationLoadError && <Alert type="error">{organizationLoadError}</Alert>}
      {message && <Alert type="success">{message}</Alert>}

      <div className="profile-layout">
        <aside className="profile-summary-card" aria-label="Profile summary">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar" aria-hidden="true">
              <UserRound size={64} />
            </div>
            <Badge tone="role">Graduate profile</Badge>
          </div>

          <div className="profile-summary-copy">
            <h2>{displayProgram}</h2>
            <p>{displayInstitution}</p>
          </div>

          <div className="profile-progress-panel">
            <div className="profile-progress-heading">
              <span>Profile completion</span>
              <strong>{completionPercent}%</strong>
            </div>
            <ProgressBar value={completionPercent} />
            <p>Complete your profile so assessment reports can identify your organisation, program, and ICT specialization clearly.</p>
          </div>

          <div className="profile-quick-list">
            <ProfileFact icon={<IdCard size={17} />} label="Full name" value={profile.registrationNumber} />
            <ProfileFact icon={<Phone size={17} />} label="Phone" value={profile.phone} />
            <ProfileFact icon={<MapPin size={17} />} label="Location" value={[profile.sector, profile.district || "Kicukiro"].filter(Boolean).join(", ")} />
            <ProfileFact icon={<CalendarDays size={17} />} label="Graduation year" value={profile.graduationYear ? String(profile.graduationYear) : ""} />
          </div>
        </aside>

        <form className="profile-editor-card" onSubmit={handleSubmit}>
          <div className="profile-editor-header">
            <div>
              <span>Edit profile details</span>
              <h2>Academic and contact information</h2>
              <p>These details appear in your assessment history, gap reports, and organisation review records.</p>
            </div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Profile"}
            </Button>
          </div>

          <div className="profile-detail-strip">
            <ProfileDetail icon={<School size={18} />} label="Organisation" value={profile.institution} />
            <ProfileDetail icon={<BookOpenCheck size={18} />} label="Program" value={profile.program} />
            <ProfileDetail icon={<FileText size={18} />} label="Specialization" value={profile.specialization} />
          </div>

          <div className="profile-form-grid">
            <TextField
              label="Full name"
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
            <SelectField
              label="Gender"
              value={profile.gender || ""}
              onChange={(event) =>
                setProfile({ ...profile, gender: event.target.value })
              }
            >
              <option value="">Select gender</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </SelectField>
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
            <SelectField
              label="Organisation"
              value={profile.institution || ""}
              disabled={isLoadingOrganizations}
              onChange={(event) =>
                setProfile({ ...profile, institution: event.target.value })
              }
            >
              <option value="">
                {isLoadingOrganizations
                  ? "Loading organisations..."
                  : "Select organisation"}
              </option>
              {organizations
                .filter((organization) => organization.status !== "inactive")
                .map((organization) => (
                  <option key={organization._id} value={organization.name}>
                    {organization.name}
                  </option>
                ))}
              {profile.institution &&
                !organizations.some(
                  (organization) => organization.name === profile.institution,
                ) && (
                  <option value={profile.institution}>{profile.institution}</option>
                )}
            </SelectField>
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
              min="2000"
              max="2100"
              value={profile.graduationYear || ""}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  graduationYear: event.target.value
                    ? Number(event.target.value)
                    : undefined,
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
                rows={5}
                value={profile.bio || ""}
                placeholder="Briefly describe your ICT interests, practical experience, and career goal."
                onChange={(event) =>
                  setProfile({ ...profile, bio: event.target.value })
                }
              />
            </div>
          </div>

          <div className="profile-save-bar">
            <p>Review your details before saving. Accurate profile information improves report clarity.</p>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

function ProfileFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div className="profile-fact">
      <span aria-hidden="true">{icon}</span>
      <div>
        <strong>{label}</strong>
        <p>{value || "Not added yet"}</p>
      </div>
    </div>
  );
}

function ProfileDetail({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div className="profile-detail-card">
      <span aria-hidden="true">{icon}</span>
      <div>
        <strong>{label}</strong>
        <p>{value || "Not added yet"}</p>
      </div>
    </div>
  );
}
export function SubmitAssessmentPage({ token }: { token: string }) {
  const { data: competencies, isLoading } = useAsyncData(
    () => api.competencies(token),
    [],
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [competency, setCompetency] = useState("");
  const [assessmentCompetencySearch, setAssessmentCompetencySearch] = useState("");
  const [assessmentCategoryFilter, setAssessmentCategoryFilter] = useState("all");
  const [practicalTaskId, setPracticalTaskId] = useState("");
  const [practicalTask, setPracticalTask] = useState("");
  const [githubRepositoryUrl, setGithubRepositoryUrl] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<
    { name: string; type?: string; size?: number; dataUrl: string }[]
  >([]);
  const [theoryAnswers, setTheoryAnswers] = useState<Record<string, string>>(
    {},
  );
  const [repositoryTaskReview, setRepositoryTaskReview] = useState<{
    competency: string;
    githubRepositoryUrl: string;
    practicalTaskId: string;
    taskReview: RepositoryTaskReview;
  } | null>(null);
  const [isReviewingRepository, setIsReviewingRepository] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const assessmentCategoryOptions = useMemo(
    () => uniqueFilterOptions(competencies.map((item) => item.category)),
    [competencies],
  );
  const filteredAssessmentCompetencies = useMemo(
    () =>
      competencies.filter((item) => {
        const matchesCategory =
          assessmentCategoryFilter === "all" ||
          item.category === assessmentCategoryFilter;
        return (
          matchesCategory &&
          matchesSearchTerm(
            assessmentCompetencySearch,
            item.code,
            item.title,
            item.category,
            item.description,
            item.expectedEvidence,
            item.practicalTasks,
            item.theoryQuestions,
          )
        );
      }),
    [competencies, assessmentCategoryFilter, assessmentCompetencySearch],
  );
  const selectedCompetency = competencies.find(
    (item) => item._id === competency,
  );
  const displayedAssessmentCompetencies =
    selectedCompetency &&
    !filteredAssessmentCompetencies.some((item) =>
      item._id === selectedCompetency._id,
    )
      ? [selectedCompetency, ...filteredAssessmentCompetencies]
      : filteredAssessmentCompetencies;
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
  const canReview = practicalEvidenceReady && requiredTheoryAnswered;
  const canSubmit =
    Boolean(competency) && practicalEvidenceReady && requiredTheoryAnswered;
  const competencyStepDone = Boolean(selectedCompetency);
  const evidenceStepDone = practicalEvidenceReady && requiredTheoryAnswered;
  const reviewStepDone = canSubmit;

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
      setMessage(
        "Assessment completed. Automatic scores, gap results, recommendations, and report are ready.",
      );
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

  function resetAssessmentEvidence() {
    setPracticalTask("");
    setGithubRepositoryUrl("");
    setEvidenceFiles([]);
    setPracticalTaskId("");
    setTheoryAnswers({});
    setRepositoryTaskReview(null);
  }

  function handleSelectCompetency(nextCompetencyId: string) {
    if (nextCompetencyId === competency) return;
    resetAssessmentEvidence();
    setCompetency(nextCompetencyId);
    setError("");
    setMessage("");
  }

  function handleCancelSelectedCompetency() {
    resetAssessmentEvidence();
    setCompetency("");
    setCurrentStep(1);
    setError("");
    setMessage("");
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
      setMessage(
        "Repository task review completed. Check the task score and checklist.",
      );
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
                done={competencyStepDone}
                label="1"
                text="Choose competency"
              />
              <StepItem
                active={currentStep === 2}
                done={evidenceStepDone}
                label="2"
                text="Add evidence"
              />
              <StepItem
                active={currentStep === 3}
                done={reviewStepDone}
                label="3"
                text="Review & submit"
              />
            </div>
          </Card>

          {currentStep === 1 && (
            <Card title="Choose the competency you want assessed">
              <div className="form-stack">
                <ListToolbar
                  search={assessmentCompetencySearch}
                  onSearchChange={setAssessmentCompetencySearch}
                  searchPlaceholder="Search code, title, category, evidence..."
                  totalCount={competencies.length}
                  filteredCount={filteredAssessmentCompetencies.length}
                >
                  <SelectField
                    label="Category filter"
                    value={assessmentCategoryFilter}
                    onChange={(event) =>
                      setAssessmentCategoryFilter(event.target.value)
                    }
                  >
                    <option value="all">All categories</option>
                    {assessmentCategoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </SelectField>
                </ListToolbar>

                {displayedAssessmentCompetencies.length === 0 ? (
                  <EmptyState message="No competencies match your search or filter." />
                ) : (
                  <div className="table-wrap assessment-competency-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date created</th>
                          <th>Category</th>
                          <th>Code</th>
                          <th>Title</th>
                          <th>Assessment content</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedAssessmentCompetencies.map((item) => {
                          const createdAt = (item as Competency & { createdAt?: string }).createdAt;
                          const isSelected = competency === item._id;
                          const practicalCount = item.practicalTasks?.length || 0;
                          const theoryCount = item.theoryQuestions?.length || 0;

                          return (
                            <tr
                              className={isSelected ? "selected-row" : ""}
                              key={item._id}
                            >
                              <td>{formatDate(createdAt)}</td>
                              <td>{item.category}</td>
                              <td>
                                <strong>{item.code}</strong>
                              </td>
                              <td>
                                <div className="competency-title-cell">
                                  <strong>{item.title}</strong>
                                  <ReadMoreText
                                    text={item.description}
                                    emptyText="No description provided."
                                    limit={90}
                                  />
                                </div>
                              </td>
                              <td>
                                {practicalCount} GitHub task(s), {theoryCount} theory question(s)
                              </td>
                              <td>
                                <Button
                                  type="button"
                                  variant={isSelected ? "danger" : "primary"}
                                  onClick={() =>
                                    isSelected
                                      ? handleCancelSelectedCompetency()
                                      : handleSelectCompetency(item._id)
                                  }
                                >
                                  {isSelected ? "Cancel" : "Select"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {selectedCompetency && (
                  <div className="competency-summary selected-competency-summary">
                    <div className="selected-competency-title">
                      <span>Title</span>
                      <strong>{selectedCompetency.title}</strong>
                    </div>
                    <div className="selected-competency-evidence">
                      <span>Expected evidence</span>
                      <ReadMoreText
                        text={selectedCompetency.expectedEvidence}
                        emptyText="Expected evidence will be confirmed from the practical task instructions."
                        limit={140}
                      />
                    </div>
                    <div className="selected-competency-package">
                      <span>Assessment package</span>
                      <p>
                        {availableTasks.length} practical task(s) and{" "}
                        {theoryQuestions.length} theory question(s).
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleCancelSelectedCompetency}
                    >
                      Change competency
                    </Button>
                  </div>
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

        {currentStep > 1 && (
          <form className="assessment-panel" onSubmit={handleSubmit}>

          {currentStep === 2 && (
            <Card title="Complete the practical test and theory questions">
              <div className="form-stack">
                <Alert type="info">
                  Practical evidence is based on a GitHub repository. The system
                  scans the repository against the selected task and shows a
                  checklist score before you submit for automatic scoring.
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
                          Score:{" "}
                          {formatPercent(activeRepositoryTaskReview.score)}
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
                    <ReadMoreText text={selectedTask.instructions} limit={220} />
                    {selectedTask.deliverables && (
                      <div>
                        <strong>Required deliverables</strong>
                        <ReadMoreText text={selectedTask.deliverables} limit={180} />
                      </div>
                    )}
                    <TextField
                      label="GitHub repository evidence URL"
                      type="url"
                      value={githubRepositoryUrl}
                      onChange={(event) =>
                        setGithubRepositoryUrl(event.target.value)
                      }
                      placeholder={GITHUB_PLACEHOLDER.INDIVIDUAL_PROJECT}
                      required
                    />
                    <div className="button-row">
                      <Button
                        disabled={
                          isReviewingRepository || !githubRepositoryUrl.trim()
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
                        <RepositoryChecklistTable checklist={activeRepositoryTaskReview.checklist} />
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
                        <ReadMoreText text={question.question} limit={180} />
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
        )}
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
      <span
        className="step-marker"
        aria-label={done ? `${text} completed` : `${text} step`}
      >
        {done ? <CheckCircle2 size={18} aria-hidden="true" /> : label}
      </span>
      <strong>{text}</strong>
      {done && <em>Done</em>}
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
                        theory evidence, verify authenticity, and approve the
                        final recommendation.
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

  const repositoryTaskReview =
    assessment.evidence.repositorySummary?.taskReview;
  const effectivePracticalScore =
    repositoryTaskReview?.score ?? assessment.scores.practicalTaskScore ?? 0;
  const previewScore = useMemo(
    () => effectivePracticalScore * 0.7 + quizScore * 0.3,
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
        setDraftStatus(
          "Generating Gemini recommendation from performance data...",
        );

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
          learningResources: draftPreview.recommendation.learningResources || [],
          geminiDraft: {
            message: draftPreview.recommendation.message,
            actionItems: draftPreview.recommendation.actionItems,
            resources: draftPreview.recommendation.resources,
            learningResources: draftPreview.recommendation.learningResources || [],
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
            Review the GitHub practical task, theory answers, and final
            recommendation before submitting the official gap result.
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
              <p>
                Use these artifacts to confirm that the work is real and aligned
                with the selected practical task.
              </p>
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
                {theoryAnswers.length}/
                {assessment.competency.theoryQuestions?.length ||
                  theoryAnswers.length ||
                  0}
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
            <ReadMoreText
              text={assessment.evidence.practicalTask}
              emptyText="No practical task details provided."
              limit={220}
            />
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
                  <ReadMoreText
                    text={assessment.evidence.repositorySummary.summaryText}
                    limit={220}
                  />
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
                        <li key={note}>
                          <ReadMoreText text={note} limit={160} />
                        </li>
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
                    <ReadMoreText
                      text={assessment.evidence.repositorySummary.taskReview.summary}
                      limit={180}
                    />
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
                              .implementationReview
                              .implementationEvidenceScore || 0,
                          )}
                          . Functional coverage:{" "}
                          {formatPercent(
                            assessment.evidence.repositorySummary.taskReview
                              .implementationReview.functionalCoverageRate || 0,
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
                    <RepositoryChecklistTable checklist={assessment.evidence.repositorySummary.taskReview.checklist} />
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
                              <ReadMoreText text={item.evidence} limit={140} />
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
                              <li key={item}>
                                <ReadMoreText text={item} limit={150} />
                              </li>
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
                    <ReadMoreText
                      text={assessment.evidence.repositorySummary.readmeExcerpt}
                      limit={240}
                    />
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
                          <ReadMoreText
                            text={file.excerpt}
                            emptyText="No excerpt available."
                            limit={260}
                          />
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
                    <ReadMoreText text={answer.question} limit={160} />
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
        <form
          className="form-stack review-panel review-form-panel"
          onSubmit={handleReview}
        >
          {error && <Alert type="error">{error}</Alert>}
          <div
            className="recommendation-approval-panel"
            id="review-recommendation"
          >
            <div className="review-section-title">
              <span>03</span>
              <div>
                <h3>Approve Gemini recommendation</h3>
                <p>
                  Gemini uses the GitHub task score, theory score, benchmark,
                  gap level, and assessor notes to draft practical guidance.
                </p>
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
                    <span className="eyebrow">
                      Gemini performance-based draft
                    </span>
                    <ReadMoreText
                      text={draftPreview.recommendation.message}
                      limit={180}
                    />
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
                {((draftPreview.recommendation.learningResources?.length || 0) > 0 ||
                  draftPreview.recommendation.resources.length > 0) && (
                  <div className="gemini-list-block">
                    <strong>Suggested learning resources</strong>
                    <LearningResourceCards
                      resources={draftPreview.recommendation.learningResources || []}
                      fallback={draftPreview.recommendation.resources}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="gemini-recommendation-card muted">
                <span className="eyebrow">Gemini draft</span>
                <strong>Recommendation draft is not available yet.</strong>
                <p>
                  Confirm Gemini configuration and assessment scores, then use
                  the generate button again. The review cannot be saved until
                  Gemini returns a recommendation.
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
              <p>
                The system assesses only GitHub practical task and theory/quiz.
                Practical/GitHub carries 70% and theory/quiz carries 30%.
              </p>
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
                    checked={Boolean(
                      evidenceVerification[
                        key as keyof typeof evidenceVerification
                      ],
                    )}
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
  const [gapSearch, setGapSearch] = useState("");
  const [gapLevelFilter, setGapLevelFilter] = useState("all");
  const gapLevelOptions = useMemo(
    () => uniqueFilterOptions(data.map((assessment) => assessment.gapLevel)),
    [data],
  );
  const filteredGapResults = useMemo(
    () =>
      data.filter((assessment) => {
        const recommendation = recommendations.find(
          (item) => item.competency._id === assessment.competency._id,
        );
        const matchesGapLevel =
          gapLevelFilter === "all" || assessment.gapLevel === gapLevelFilter;
        return (
          matchesGapLevel &&
          matchesSearchTerm(
            gapSearch,
            assessment.competency,
            assessment.graduate,
            assessment.gapLevel,
            assessment.assessorComment,
            assessment.evidence.repositorySummary?.summaryText,
            recommendation?.message,
          )
        );
      }),
    [data, gapLevelFilter, gapSearch, recommendations],
  );

  if (isLoading) return <LoadingState message="Loading gap results..." />;

  const averageScore = data.length
    ? data.reduce(
        (total, assessment) => total + Number(assessment.scores.finalScore || 0),
        0,
      ) / data.length
    : 0;
  const highGapCount = data.filter(
    (assessment) => assessment.gapLevel === "High Gap",
  ).length;
  const latestReviewed = data
    .map((assessment) => assessment.reviewedAt || assessment.createdAt)
    .filter(Boolean)
    .sort()
    .at(-1);

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
        <>
          <div className="stat-grid">
            <StatCard
              helper="Reviewed competency results"
              icon={<Target size={20} />}
              label="Total results"
              value={data.length}
            />
            <StatCard
              helper="Average reviewed competency score"
              icon={<Gauge size={20} />}
              label="Average score"
              tone="green"
              value={formatPercent(averageScore)}
            />
            <StatCard
              helper={`Latest review: ${latestReviewed ? formatDate(latestReviewed) : "N/A"}`}
              icon={<AlertTriangle size={20} />}
              label="High gaps"
              tone={highGapCount > 0 ? "red" : "slate"}
              value={highGapCount}
            />
          </div>
          <ListToolbar
            search={gapSearch}
            onSearchChange={setGapSearch}
            searchPlaceholder="Search competency, graduate, recommendation..."
            totalCount={data.length}
            filteredCount={filteredGapResults.length}
          >
            <SelectField
              label="Gap level"
              value={gapLevelFilter}
              onChange={(event) => setGapLevelFilter(event.target.value)}
            >
              <option value="all">All gap levels</option>
              {gapLevelOptions.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </SelectField>
          </ListToolbar>
          {filteredGapResults.length === 0 ? (
            <EmptyState message="No gap results match your search or filter." />
          ) : (
          <div className="result-page-list">
          {filteredGapResults.map((assessment) => {
            const recommendation = recommendations.find(
              (item) => item.competency._id === assessment.competency._id,
            );

            return (
              <article className="result-card result-page-card" key={assessment._id}>
                <header className="result-page-card__header">
                  <div>
                    <span className="eyebrow">Competency result</span>
                    <h3>{assessment.competency.title}</h3>
                  </div>
                  <div className="result-page-card__status">
                    <GapBadge level={assessment.gapLevel} />
                    <span>Reviewed {formatDate(assessment.reviewedAt)}</span>
                  </div>
                </header>

                <div className="result-score-panel">
                  <div>
                    <span>Graduate score</span>
                    <strong>{formatPercent(assessment.scores.finalScore)}</strong>
                  </div>
                  <div>
                    <span>RTB benchmark</span>
                    <strong>{formatPercent(assessment.benchmarkScore)}</strong>
                  </div>
                  <div>
                    <span>Skill gap</span>
                    <strong>{formatPercent(assessment.skillGap)}</strong>
                  </div>
                </div>

                <ProgressBar value={assessment.scores.finalScore} />

                <div className="result-detail-grid">
                  <section className="assessor-note">
                    <div className="section-heading">
                      <strong>Score breakdown</strong>
                      <span>70% practical, 30% theory</span>
                    </div>
                    <div className="result-metrics">
                      <span>
                        GitHub task:{" "}
                        {formatPercent(assessment.scores.practicalTaskScore)}
                      </span>
                      <span>
                        Theory: {formatPercent(assessment.scores.quizScore)}
                      </span>
                    </div>
                  </section>

                  <section className="assessor-note">
                    <div className="section-heading">
                      <strong>Evidence verification</strong>
                      <span>{assessment.evidenceVerification ? "Recorded" : "Pending"}</span>
                    </div>
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
                      <ReadMoreText
                        text={assessment.evidenceVerification.authenticityNotes}
                        limit={160}
                      />
                    )}
                  </section>

                  <section className="assessor-note">
                    <strong>Assessor comment</strong>
                    <ReadMoreText
                      text={assessment.assessorComment}
                      emptyText="No assessor comment provided."
                      limit={160}
                    />
                  </section>

                  <section className="assessor-note">
                    <strong>Repository summary</strong>
                    <ReadMoreText
                      text={assessment.evidence.repositorySummary?.summaryText}
                      emptyText="No GitHub repository summary was stored for this assessment."
                      limit={190}
                    />
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
                  </section>

                  <section className="assessor-note result-recommendation-panel">
                    <strong>Recommendation</strong>
                    <ReadMoreText
                      text={recommendation?.message}
                      emptyText="Recommendation will appear after the assessor adds improvement guidance."
                      limit={180}
                    />
                    {recommendation &&
                      recommendation.actionItems.length > 0 && (
                        <ul>
                          {recommendation.actionItems.map((item) => (
                            <li key={item}>
                              <ReadMoreText text={item} limit={150} />
                            </li>
                          ))}
                        </ul>
                      )}
                    {recommendation &&
                      ((recommendation.learningResources &&
                        recommendation.learningResources.length > 0) ||
                        (recommendation.resources &&
                          recommendation.resources.length > 0)) && (
                        <>
                          <strong style={{ marginTop: '0.75rem', display: 'block' }}>
                            Learning resources
                          </strong>
                          <LearningResourceCards
                            resources={recommendation.learningResources || []}
                            fallback={recommendation.resources}
                          />
                        </>
                      )}
                  </section>
                </div>
              </article>
            );
          })}
          </div>
          )}
        </>
      )}
    </section>
  );
}

export function RecommendationsPage({ token }: { token: string }) {
  const { data, isLoading, error, refresh } = useAsyncData(
    () => api.recommendations(token),
    [] as Recommendation[],
  );
  const [recommendationSearch, setRecommendationSearch] = useState("");
  const [recommendationPriorityFilter, setRecommendationPriorityFilter] = useState("all");
  const recommendationPriorityOptions = useMemo(
    () => uniqueFilterOptions(data.map((recommendation) => recommendation.priority)),
    [data],
  );
  const filteredRecommendations = useMemo(
    () =>
      data.filter((recommendation) => {
        const matchesPriority =
          recommendationPriorityFilter === "all" ||
          recommendation.priority === recommendationPriorityFilter;
        return (
          matchesPriority &&
          matchesSearchTerm(
            recommendationSearch,
            recommendation.competency,
            recommendation.message,
            recommendation.draftMessage,
            recommendation.actionItems,
            recommendation.resources,
            recommendation.learningResources,
            recommendation.gapLevel,
            recommendation.priority,
          )
        );
      }),
    [data, recommendationPriorityFilter, recommendationSearch],
  );

  if (isLoading) return <LoadingState message="Loading recommendations..." />;

  const highPriorityCount = data.filter(
    (recommendation) => recommendation.priority === "high",
  ).length;
  const approvedCount = data.filter(
    (recommendation) => recommendation.isApproved,
  ).length;
  const actionItemCount = data.reduce(
    (total, recommendation) =>
      total + Number(recommendation.actionItems?.length || 0),
    0,
  );

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
        <>
          <div className="stat-grid">
            <StatCard
              helper="Competency-linked guidance items"
              icon={<Award size={20} />}
              label="Recommendations"
              value={data.length}
            />
            <StatCard
              helper="Items requiring urgent improvement"
              icon={<AlertTriangle size={20} />}
              label="High priority"
              tone={highPriorityCount > 0 ? "red" : "slate"}
              value={highPriorityCount}
            />
            <StatCard
              helper={`${approvedCount} approved recommendation(s)`}
              icon={<ClipboardCheck size={20} />}
              label="Action items"
              tone="green"
              value={actionItemCount}
            />
          </div>

          <ListToolbar
            search={recommendationSearch}
            onSearchChange={setRecommendationSearch}
            searchPlaceholder="Search competency, action plan, resources..."
            totalCount={data.length}
            filteredCount={filteredRecommendations.length}
          >
            <SelectField
              label="Priority"
              value={recommendationPriorityFilter}
              onChange={(event) => setRecommendationPriorityFilter(event.target.value)}
            >
              <option value="all">All priorities</option>
              {recommendationPriorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </SelectField>
          </ListToolbar>
          {filteredRecommendations.length === 0 ? (
            <EmptyState message="No recommendations match your search or filter." />
          ) : (
          <div className="recommendation-page-grid">
          {filteredRecommendations.map((recommendation) => (
            <article className="recommendation recommendation-page-card" key={recommendation._id}>
              <header className="recommendation-page-card__header">
                <div>
                  <span className="eyebrow">Improvement guidance</span>
                  <h3>{recommendation.competency.title}</h3>
                </div>
                <div className="recommendation-page-card__badges">
                  <GapBadge level={recommendation.gapLevel} />
                  <Badge tone={recommendation.priority === "high" ? "danger" : recommendation.priority === "medium" ? "warning" : "success"}>
                    {recommendation.priority} priority
                  </Badge>
                </div>
              </header>

              <section className="recommendation-message-panel">
                <strong>Approved recommendation</strong>
                <ReadMoreText text={recommendation.message} limit={240} />
                {recommendation.draftMessage &&
                  recommendation.draftMessage !== recommendation.message && (
                    <div className="recommendation-draft-panel">
                      <strong>Gemini draft reference</strong>
                      <ReadMoreText
                        text={recommendation.draftMessage}
                        limit={220}
                      />
                    </div>
                  )}
              </section>

              <div className="recommendation-support-grid">
                <section className="assessor-note">
                  <div className="section-heading">
                    <strong>Action plan to close the measured gap</strong>
                    <span>{recommendation.actionItems.length} step(s)</span>
                  </div>
                  <p className="recommendation-guidance">
                    Follow these steps in order, starting with the weakest evidence area found in the task review and theory score.
                  </p>
                {recommendation.actionItems.length > 0 && (
                  <ul>
                    {recommendation.actionItems.map((item) => (
                      <li key={item}>
                        <ReadMoreText text={item} limit={150} />
                      </li>
                    ))}
                  </ul>
                )}
                {recommendation.actionItems.length === 0 && (
                  <p>No action items were added.</p>
                )}
                </section>

                <section className="assessor-note">
                  <div className="section-heading">
                    <strong>Learning resources</strong>
                    <span>
                      {(recommendation.learningResources?.length || recommendation.resources.length)} item(s)
                    </span>
                  </div>
                  <LearningResourceCards
                    resources={recommendation.learningResources || []}
                    fallback={recommendation.resources}
                  />
                  {(recommendation.learningResources?.length || recommendation.resources.length) === 0 && (
                    <p>No learning resources were added.</p>
                  )}
                </section>

                <section className="assessor-note">
                  <div className="section-heading">
                    <strong>Recommendation details</strong>
                    <span>{recommendation.isApproved ? "Approved" : "Draft"}</span>
                  </div>
                  <div className="result-metrics">
                    <span>Provider: {recommendation.aiProvider || "Gemini"}</span>
                    <span>Model: {recommendation.aiModel || "N/A"}</span>
                    <span>
                      Approved:{" "}
                      {recommendation.approvedAt
                        ? formatDate(recommendation.approvedAt)
                        : "Not recorded"}
                    </span>
                  </div>
                </section>
              </div>
            </article>
          ))}
          </div>
          )}
        </>
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
  const [reportSearch, setReportSearch] = useState("");
  const [reportGapFilter, setReportGapFilter] = useState("all");
  const reportGapOptions = useMemo(
    () => uniqueFilterOptions(data.map((report) => report.overallGapLevel)),
    [data],
  );
  const filteredReports = useMemo(
    () =>
      data.filter((report) => {
        const matchesGap =
          reportGapFilter === "all" || report.overallGapLevel === reportGapFilter;
        return (
          matchesGap &&
          matchesSearchTerm(
            reportSearch,
            report.title,
            report.summary,
            report.overallGapLevel,
            report.graduate,
            report.assessments,
            report.strengths,
            report.weaknesses,
          )
        );
      }),
    [data, reportGapFilter, reportSearch],
  );

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

  const averageOverallScore = data.length
    ? data.reduce((total, report) => total + Number(report.overallScore || 0), 0) /
      data.length
    : 0;
  const includedAssessmentCount = data.reduce(
    (total, report) => total + Number(report.assessments?.length || 0),
    0,
  );

  return (
    <section className="page-stack">
      <PageHeader
        title="Reports"
        description="Generate and review report summaries for competency performance."
        onRefresh={refresh}
      />
      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}
      <div className="report-command-panel">
        <div>
          <span className="eyebrow">Report center</span>
          <h3>Generate and download reviewed assessment reports</h3>
          <p>
            Reports summarize reviewed competencies, final scores, gap levels,
            repository evidence, and approved recommendations.
          </p>
        </div>
        <div className="report-command-panel__actions">
          {!isLearnerRole(role) && (
            <TextField
              label="Assessment user ID"
              value={graduateId}
              onChange={(event) => setGraduateId(event.target.value)}
            />
          )}
          <Button onClick={handleGenerate}>Generate Report</Button>
        </div>
      </div>
      {data.length === 0 ? (
        <EmptyState message="No reports generated yet." />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard
              helper="Generated report records"
              icon={<BarChart3 size={20} />}
              label="Reports"
              value={data.length}
            />
            <StatCard
              helper="Average score across reports"
              icon={<Gauge size={20} />}
              label="Average overall score"
              tone="green"
              value={formatPercent(averageOverallScore)}
            />
            <StatCard
              helper="Reviewed competencies included"
              icon={<ClipboardCheck size={20} />}
              label="Included assessments"
              tone="slate"
              value={includedAssessmentCount}
            />
          </div>

          <ListToolbar
            search={reportSearch}
            onSearchChange={setReportSearch}
            searchPlaceholder="Search title, graduate, competency, summary..."
            totalCount={data.length}
            filteredCount={filteredReports.length}
          >
            <SelectField
              label="Gap level"
              value={reportGapFilter}
              onChange={(event) => setReportGapFilter(event.target.value)}
            >
              <option value="all">All gap levels</option>
              {reportGapOptions.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </SelectField>
          </ListToolbar>
          {filteredReports.length === 0 ? (
            <EmptyState message="No reports match your search or filter." />
          ) : (
          <div className="report-page-list">
          {filteredReports.map((report) => (
            <article className="report-page-card report-preview" key={report._id}>
              <header className="report-page-card__header">
                <div>
                  <span className="eyebrow">Graduate report</span>
                  <h3>{report.title}</h3>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => downloadReport(report)}
                >
                  Download Report
                </Button>
              </header>

              <div className="report-score-panel">
                <div>
                  <span>Overall score</span>
                  <strong>{formatPercent(report.overallScore)}</strong>
                </div>
                <div>
                  <span>Gap level</span>
                  <strong>{report.overallGapLevel}</strong>
                </div>
                <div>
                  <span>Generated</span>
                  <strong>{formatDate(report.createdAt)}</strong>
                </div>
              </div>

              <ReadMoreText text={report.summary} limit={240} />

              <div className="report-detail-grid">
                {report.assessments && report.assessments.length > 0 && (
                <section className="assessor-note">
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
                </section>
                )}
                {report.assessments && report.assessments.length > 0 && (
                <section className="assessor-note">
                  <strong>Repository summaries</strong>
                  <ul>
                    {report.assessments.map((assessment) => (
                      <li key={`${report._id}-${assessment._id}-repo`}>
                        <strong>{assessment.competency.title}</strong>
                        <ReadMoreText
                          text={assessment.evidence.repositorySummary?.summaryText}
                          emptyText="No repository summary available."
                          limit={150}
                        />
                        {assessment.evidence.repositorySummary && (
                          <span>
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
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
                )}
              </div>
            </article>
          ))}
          </div>
          )}
        </>
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
  const [notificationSearch, setNotificationSearch] = useState("");
  const [notificationStatusFilter, setNotificationStatusFilter] = useState("all");
  const [notificationTypeFilter, setNotificationTypeFilter] = useState("all");
  const notificationTypeOptions = useMemo(
    () => uniqueFilterOptions(data.map((notification) => notification.type)),
    [data],
  );
  const filteredNotifications = useMemo(
    () =>
      data.filter((notification) => {
        const matchesStatus =
          notificationStatusFilter === "all" ||
          (notificationStatusFilter === "unread" && !notification.isRead) ||
          (notificationStatusFilter === "read" && notification.isRead);
        const matchesType =
          notificationTypeFilter === "all" || notification.type === notificationTypeFilter;
        return (
          matchesStatus &&
          matchesType &&
          matchesSearchTerm(
            notificationSearch,
            notification.title,
            notification.message,
            notification.type,
            notification.createdAt,
          )
        );
      }),
    [data, notificationSearch, notificationStatusFilter, notificationTypeFilter],
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
        <>
          <ListToolbar
            search={notificationSearch}
            onSearchChange={setNotificationSearch}
            searchPlaceholder="Search notification title, message, type..."
            totalCount={data.length}
            filteredCount={filteredNotifications.length}
          >
            <SelectField
              label="Status"
              value={notificationStatusFilter}
              onChange={(event) => setNotificationStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </SelectField>
            <SelectField
              label="Type"
              value={notificationTypeFilter}
              onChange={(event) => setNotificationTypeFilter(event.target.value)}
            >
              <option value="all">All types</option>
              {notificationTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </SelectField>
          </ListToolbar>
          {filteredNotifications.length === 0 ? (
            <EmptyState message="No notifications match your search or filter." />
          ) : (
        <div className="card-list">
          {filteredNotifications.map((notification) => (
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
                <ReadMoreText text={notification.message} limit={180} />
                {!notification.isRead && <strong>Unread</strong>}
              </div>
            </Card>
          ))}
        </div>
          )}
        </>
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
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: defaultRole as Role,
    organizationId: "",
  });
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

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

    if (
      ["organization_user", "org_admin"].includes(form.role) &&
      role !== "org_admin" &&
      !form.organizationId
    ) {
      setFormError(
        "Select an organization for organization users and organization admins.",
      );
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
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to create user",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function startEditUser(user: User) {
    setEditingUserId(user.id);
    let orgId = "";
    if (typeof user.organization === "string") {
      orgId = user.organization;
    } else if (
      user.organization &&
      typeof user.organization === "object" &&
      "_id" in user.organization
    ) {
      orgId = user.organization._id;
    }
    setEditForm({
      name: user.name,
      role: user.role,
      organizationId: orgId,
    });
    setFormError("");
    setMessage("");
  }

  async function handleUpdateUser() {
    setMessage("");
    setFormError("");

    if (!editForm.name.trim()) {
      setFormError("Name is required.");
      return;
    }

    if (!editingUserId) return;

    setIsSaving(true);
    try {
      await api.updateUser(token, editingUserId, {
        name: editForm.name.trim(),
        role: editForm.role,
      });
      setEditingUserId(null);
      setMessage("User updated successfully.");
      await refresh();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update user",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    setIsDeleting(userId);
    setFormError("");
    setMessage("");

    try {
      await api.deleteUser(token, userId);
      setMessage("User deleted successfully.");
      await refresh();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to delete user",
      );
    } finally {
      setIsDeleting(null);
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
      {organizationError && role === "admin" && (
        <Alert type="error">{organizationError}</Alert>
      )}
      <Alert type="info">
        After an account is created, administrators and organization admins
        cannot reset that user&apos;s password. The user must use Forgot
        Password to receive a secure reset link and manage their own account
        access.
      </Alert>
      {message && <Alert type="success">{message}</Alert>}
      {formError && <Alert type="error">{formError}</Alert>}

      {editingUserId ? (
        <Card title="Edit user" icon={<Users size={20} />}>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              handleUpdateUser();
            }}
          >
            <TextField
              label="Full name"
              value={editForm.name}
              onChange={(event) =>
                setEditForm({ ...editForm, name: event.target.value })
              }
              required
            />
            <SelectField
              label="Role"
              value={editForm.role}
              onChange={(event) =>
                setEditForm({ ...editForm, role: event.target.value as Role })
              }
            >
              {creatableRoles.map((item) => (
                <option key={item} value={item}>
                  {roleLabel(item)}
                </option>
              ))}
            </SelectField>
            {["organization_user", "org_admin"].includes(editForm.role) && (
              <SelectField
                label="Organization"
                value={editForm.organizationId}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    organizationId: event.target.value,
                  })
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
                {isSaving ? "Updating user..." : "Update user"}
              </Button>
              <Button
                variant="secondary"
                disabled={isSaving}
                onClick={() => setEditingUserId(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card title="Create user account" icon={<Users size={20} />}>
          <Alert type="info">
            Normal user self-registration is public from the homepage. Admin,
            super admin, organization admin, and organization user accounts are
            protected and must be created by an authorized administrator.
          </Alert>
          <form className="form-grid" onSubmit={handleCreateUser}>
            <TextField
              label="Full name"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              required
            />
            <TextField
              label="Temporary password"
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              required
            />
            <SelectField
              label="Role"
              value={form.role}
              onChange={(event) =>
                setForm({ ...form, role: event.target.value as Role })
              }
            >
              {creatableRoles.map((item) => (
                <option key={item} value={item}>
                  {roleLabel(item)}
                </option>
              ))}
            </SelectField>
            {role !== "org_admin" &&
              ["organization_user", "org_admin"].includes(form.role) && (
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
                    .filter(
                      (organization) => organization.status !== "inactive",
                    )
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
      )}

      <Card title="Users" icon={<Users size={20} />}>
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
                  <th>Password access</th>
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
                      {user.mustChangePassword
                        ? "Temporary password"
                        : "User-managed password"}
                    </td>
                    <td>
                      <div className="button-row">
                        <Button
                          variant="secondary"
                          onClick={() => startEditUser(user)}
                          disabled={editingUserId !== null}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          disabled={isDeleting === user.id}
                          onClick={() => void handleDeleteUser(user.id)}
                        >
                          {isDeleting === user.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    district: "",
    type: "tvet_institution" as Organization["type"],
    contactEmail: "",
    phone: "",
    address: "",
  });
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

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

  function startEditOrganization(org: Organization) {
    setEditingId(org._id);
    setEditForm({
      name: org.name,
      district: org.district || "",
      type: org.type || "tvet_institution",
      contactEmail: org.contactEmail || "",
      phone: org.phone || "",
      address: org.address || "",
    });
    setFormError("");
    setMessage("");
  }

  async function handleUpdateOrganization() {
    setMessage("");
    setFormError("");

    if (!editForm.name.trim()) {
      setFormError("Organization name is required.");
      return;
    }

    if (!editingId) return;

    setIsSaving(true);
    try {
      await api.updateOrganization(token, editingId, {
        name: editForm.name.trim(),
        district: editForm.district.trim(),
        type: editForm.type,
        contactEmail: editForm.contactEmail.trim(),
        phone: editForm.phone.trim(),
        address: editForm.address.trim(),
      });
      setEditingId(null);
      setMessage("Organization updated successfully.");
      await refresh();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update organization",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteOrganization(orgId: string) {
    if (!window.confirm("Are you sure you want to delete this organization?"))
      return;

    setIsDeleting(orgId);
    setFormError("");
    setMessage("");

    try {
      await api.deleteOrganization(token, orgId);
      setMessage("Organization deleted successfully.");
      await refresh();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to delete organization",
      );
    } finally {
      setIsDeleting(null);
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

      {editingId ? (
        <Card title="Edit organization" icon={<BarChart3 size={20} />}>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              handleUpdateOrganization();
            }}
          >
            <TextField
              label="Organization name"
              value={editForm.name}
              onChange={(event) =>
                setEditForm({ ...editForm, name: event.target.value })
              }
              required
            />
            <TextField
              label="District"
              value={editForm.district}
              onChange={(event) =>
                setEditForm({ ...editForm, district: event.target.value })
              }
            />
            <SelectField
              label="Organization type"
              value={editForm.type}
              onChange={(event) =>
                setEditForm({
                  ...editForm,
                  type: event.target.value as Organization["type"],
                })
              }
            >
              <option value="tvet_institution">TVET Institution</option>
              <option value="training_center">Training Center</option>
              <option value="other">Other</option>
            </SelectField>
            <TextField
              label="Contact email"
              type="email"
              value={editForm.contactEmail}
              onChange={(event) =>
                setEditForm({ ...editForm, contactEmail: event.target.value })
              }
            />
            <TextField
              label="Phone"
              value={editForm.phone}
              onChange={(event) =>
                setEditForm({ ...editForm, phone: event.target.value })
              }
            />
            <TextField
              label="Address"
              value={editForm.address}
              onChange={(event) =>
                setEditForm({ ...editForm, address: event.target.value })
              }
            />
            <div className="form-actions">
              <Button disabled={isSaving} type="submit">
                {isSaving ? "Updating organization..." : "Update organization"}
              </Button>
              <Button
                variant="secondary"
                disabled={isSaving}
                onClick={() => setEditingId(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card title="Create organization" icon={<BarChart3 size={20} />}>
          <form className="form-grid" onSubmit={handleCreateOrganization}>
            <TextField
              label="Organization name"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
            />
            <TextField
              label="District"
              value={form.district}
              onChange={(event) =>
                setForm({ ...form, district: event.target.value })
              }
            />
            <SelectField
              label="Organization type"
              value={form.type}
              onChange={(event) =>
                setForm({
                  ...form,
                  type: event.target.value as Organization["type"],
                })
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
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
            />
            <TextField
              label="Address"
              value={form.address}
              onChange={(event) =>
                setForm({ ...form, address: event.target.value })
              }
            />
            <div className="form-actions">
              <Button disabled={isSaving} type="submit">
                {isSaving ? "Creating organization..." : "Create organization"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Registered organizations" icon={<BarChart3 size={20} />}>
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((organization) => (
                  <tr key={organization._id}>
                    <td>{organization.name}</td>
                    <td>{organization.district || "N/A"}</td>
                    <td>{organization.type || "N/A"}</td>
                    <td>
                      {organization.contactEmail || organization.phone || "N/A"}
                    </td>
                    <td>{organization.status || "active"}</td>
                    <td>
                      <div className="button-row">
                        <Button
                          variant="secondary"
                          onClick={() => startEditOrganization(organization)}
                          disabled={editingId !== null}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          disabled={isDeleting === organization._id}
                          onClick={() =>
                            void handleDeleteOrganization(organization._id)
                          }
                        >
                          {isDeleting === organization._id
                            ? "Deleting..."
                            : "Delete"}
                        </Button>
                      </div>
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

const CHECKLIST_CATEGORIES = [
  "frontend",
  "backend",
  "database",
  "authentication",
  "testing",
  "documentation",
  "deployment",
  "security",
  "general",
];

const CHECKLIST_VALIDATION_TYPES = [
  "automated_test",
  "hidden_test",
  "eslint",
  "security_scan",
  "repository_scan",
  "implementation_review",
  "manual_review",
];

function formatChecklistRows(task?: PracticalTask) {
  return (task?.reviewChecklist || [])
    .map((item) =>
      [
        item.title,
        item.category || "general",
        item.validationType || "implementation_review",
        item.maxScore || 10,
        item.weight || 10,
        item.feedbackWhenFailed || "",
      ].join(" | "),
    )
    .join("\n");
}

function parseChecklistRows(value: string) {
  return value
    .split("\n")
    .map((line, index) => {
      const [
        title,
        category = "general",
        validationType = "implementation_review",
        maxScore = "10",
        weight = "10",
        feedbackWhenFailed = "",
      ] = line.split("|").map((part) => part.trim());

      if (!title) return null;

      return {
        key: `checklist-${index + 1}`,
        title,
        category: CHECKLIST_CATEGORIES.includes(category) ? category : "general",
        validationType: CHECKLIST_VALIDATION_TYPES.includes(validationType)
          ? validationType
          : "implementation_review",
        maxScore: Math.min(Math.max(Number(maxScore) || 10, 1), 100),
        weight: Math.min(Math.max(Number(weight) || 10, 1), 100),
        successThreshold: 70,
        feedbackWhenFailed,
      };
    })
    .filter(Boolean);
}

function checklistWeightTotal(value: string) {
  return parseChecklistRows(value).reduce(
    (sum, item) => sum + Number(item?.weight || 0),
    0,
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
    practicalTaskChecklist: "",
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
  const [editingCompetencyId, setEditingCompetencyId] = useState<string | null>(
    null,
  );
  const [editForm, setEditForm] = useState({
    code: "",
    title: "",
    category: "",
    description: "",
    expectedEvidence: "",
    practicalTaskTitle: "",
    practicalTaskInstructions: "",
    practicalTaskDeliverables: "",
    practicalTaskChecklist: "",
    practicalTaskTestCommand: "",
    practicalTaskTestFilePath: "",
    practicalTaskTestFileContent: "",
    theoryQuestion: "",
    theoryOptions: "",
    theoryCorrectAnswer: "",
  });
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [competencySearch, setCompetencySearch] = useState("");
  const [competencyCategoryFilter, setCompetencyCategoryFilter] = useState("all");
  const competencyCategoryOptions = useMemo(
    () => uniqueFilterOptions(data.map((item) => item.category)),
    [data],
  );
  const filteredCompetencies = useMemo(
    () =>
      data.filter((item) => {
        const matchesCategory =
          competencyCategoryFilter === "all" ||
          item.category === competencyCategoryFilter;
        return (
          matchesCategory &&
          matchesSearchTerm(
            competencySearch,
            item.code,
            item.title,
            item.category,
            item.description,
            item.expectedEvidence,
            item.practicalTasks,
            item.theoryQuestions,
          )
        );
      }),
    [data, competencyCategoryFilter, competencySearch],
  );

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
      practicalTaskChecklist: "",
      practicalTaskTestCommand: "",
      practicalTaskTestFilePath: "",
      practicalTaskTestFileContent: "",
      theoryQuestion: "",
      theoryOptions: "",
      theoryCorrectAnswer: "",
    });
  }

  function resetEditForm() {
    setEditForm({
      code: "",
      title: "",
      category: "",
      description: "",
      expectedEvidence: "",
      practicalTaskTitle: "",
      practicalTaskInstructions: "",
      practicalTaskDeliverables: "",
      practicalTaskChecklist: "",
      practicalTaskTestCommand: "",
      practicalTaskTestFilePath: "",
      practicalTaskTestFileContent: "",
      theoryQuestion: "",
      theoryOptions: "",
      theoryCorrectAnswer: "",
    });
  }

  function startEditCompetency(competency: Competency) {
    setEditingCompetencyId(competency._id);
    const practicalTask = competency.practicalTasks?.[0];
    const theoryQuestion = competency.theoryQuestions?.[0];

    setEditForm({
      code: competency.code,
      title: competency.title,
      category: competency.category,
      description: competency.description || "",
      expectedEvidence: competency.expectedEvidence || "",
      practicalTaskTitle: practicalTask?.title || "",
      practicalTaskInstructions: practicalTask?.instructions || "",
      practicalTaskDeliverables: practicalTask?.deliverables || "",
      practicalTaskChecklist: formatChecklistRows(practicalTask),
      practicalTaskTestCommand: practicalTask?.automatedTestCommand || "",
      practicalTaskTestFilePath:
        practicalTask?.automatedTestFiles?.[0]?.path || "",
      practicalTaskTestFileContent:
        practicalTask?.automatedTestFiles?.[0]?.content || "",
      theoryQuestion: theoryQuestion?.question || "",
      theoryOptions: theoryQuestion?.options?.join("\n") || "",
      theoryCorrectAnswer: theoryQuestion?.correctAnswer || "",
    });
    setFormError("");
    setMessage("");
  }

  async function handleUpdateCompetency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setFormError("");

    const validationMessage = validateCompetencyForm(editForm);
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setIsSaving(true);

    try {
      const theoryOptions = editForm.theoryOptions
        .split("\n")
        .map((option) => option.trim())
        .filter(Boolean);

      await api.updateCompetency(token, editingCompetencyId!, {
        code: editForm.code.trim(),
        title: editForm.title.trim(),
        category: editForm.category.trim(),
        description: editForm.description.trim(),
        expectedEvidence: editForm.expectedEvidence.trim(),
        practicalTasks: editForm.practicalTaskTitle.trim()
          ? [
              {
                title: editForm.practicalTaskTitle.trim(),
                instructions: editForm.practicalTaskInstructions.trim(),
                deliverables: editForm.practicalTaskDeliverables.trim(),
                estimatedMinutes: 60,
                maxScore: 100,
                reviewChecklist: parseChecklistRows(editForm.practicalTaskChecklist),
                automatedTestCommand: editForm.practicalTaskTestCommand.trim(),
                automatedTestFiles:
                  editForm.practicalTaskTestFilePath.trim() &&
                  editForm.practicalTaskTestFileContent.trim()
                    ? [
                        {
                          path: editForm.practicalTaskTestFilePath.trim(),
                          content: editForm.practicalTaskTestFileContent,
                        },
                      ]
                    : [],
              },
            ]
          : [],
        theoryQuestions: editForm.theoryQuestion.trim()
          ? [
              {
                question: editForm.theoryQuestion.trim(),
                type: "multiple_choice",
                options: theoryOptions,
                correctAnswer: editForm.theoryCorrectAnswer.trim(),
                points: 1,
              },
            ]
          : [],
      });
      setEditingCompetencyId(null);
      resetEditForm();
      setMessage("Competency updated successfully.");
      await refresh();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update competency",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteCompetency(id: string) {
    if (!window.confirm("Are you sure you want to delete this competency?")) {
      return;
    }

    setIsDeleting(id);
    try {
      await api.deleteCompetency(token, id);
      setMessage("Competency deleted successfully.");
      await refresh();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to delete competency",
      );
    } finally {
      setIsDeleting(null);
    }
  }

  function validateCompetencyForm(formData: typeof form) {
    const code = formData.code.trim();
    const title = formData.title.trim();
    const category = formData.category.trim();
    const hasPracticalTask = Boolean(formData.practicalTaskTitle.trim());
    const hasAnyInstructorTestField = Boolean(
      formData.practicalTaskTestCommand.trim() ||
      formData.practicalTaskTestFilePath.trim() ||
      formData.practicalTaskTestFileContent.trim(),
    );
    const hasCompleteInstructorTest =
      Boolean(formData.practicalTaskTestCommand.trim()) &&
      Boolean(formData.practicalTaskTestFilePath.trim()) &&
      Boolean(formData.practicalTaskTestFileContent.trim());
    const hasTheoryQuestion = Boolean(formData.theoryQuestion.trim());
    const theoryOptions = formData.theoryOptions
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean);

    if (!code || !title || !category) {
      return "Code, title, and category are required.";
    }

    if (hasPracticalTask && !formData.practicalTaskInstructions.trim()) {
      return "Task instructions are required when a practical task is added.";
    }

    if (hasAnyInstructorTestField && !hasCompleteInstructorTest) {
      return "Instructor test command, file path, and file content must all be provided together.";
    }

    if (hasTheoryQuestion && !formData.theoryCorrectAnswer.trim()) {
      return "Correct answer is required when a theory question is added.";
    }

    if (hasTheoryQuestion && theoryOptions.length < 2) {
      return "Add at least two multiple-choice options for the theory question.";
    }

    if (
      hasTheoryQuestion &&
      !theoryOptions.some(
        (option) =>
          option.toLowerCase() ===
          formData.theoryCorrectAnswer.trim().toLowerCase(),
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

    const validationMessage = validateCompetencyForm(form);
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
                reviewChecklist: parseChecklistRows(form.practicalTaskChecklist),
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
      <Card
        title={
          editingCompetencyId
            ? "Edit Competency"
            : "Add real assessment competency"
        }
        icon={<Zap size={20} />}
      >
        <form
          className="form-grid"
          onSubmit={editingCompetencyId ? handleUpdateCompetency : handleCreate}
        >
          <TextField
            label="Code"
            value={editingCompetencyId ? editForm.code : form.code}
            onChange={(event) =>
              editingCompetencyId
                ? setEditForm({ ...editForm, code: event.target.value })
                : setForm({ ...form, code: event.target.value })
            }
            required
            disabled={editingCompetencyId ? isSaving : false}
          />
          <TextField
            label="Title"
            value={editingCompetencyId ? editForm.title : form.title}
            onChange={(event) =>
              editingCompetencyId
                ? setEditForm({ ...editForm, title: event.target.value })
                : setForm({ ...form, title: event.target.value })
            }
            required
            disabled={editingCompetencyId ? isSaving : false}
          />
          <TextField
            label="Category"
            value={editingCompetencyId ? editForm.category : form.category}
            onChange={(event) =>
              editingCompetencyId
                ? setEditForm({ ...editForm, category: event.target.value })
                : setForm({ ...form, category: event.target.value })
            }
            required
            disabled={editingCompetencyId ? isSaving : false}
          />
          <TextField
            label="Description"
            value={
              editingCompetencyId ? editForm.description : form.description
            }
            onChange={(event) =>
              editingCompetencyId
                ? setEditForm({ ...editForm, description: event.target.value })
                : setForm({ ...form, description: event.target.value })
            }
            disabled={editingCompetencyId ? isSaving : false}
          />
          <TextField
            label="Expected evidence"
            value={
              editingCompetencyId
                ? editForm.expectedEvidence
                : form.expectedEvidence
            }
            onChange={(event) =>
              editingCompetencyId
                ? setEditForm({
                    ...editForm,
                    expectedEvidence: event.target.value,
                  })
                : setForm({ ...form, expectedEvidence: event.target.value })
            }
            disabled={editingCompetencyId ? isSaving : false}
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
                value={
                  editingCompetencyId
                    ? editForm.practicalTaskTitle
                    : form.practicalTaskTitle
                }
                onChange={(event) =>
                  editingCompetencyId
                    ? setEditForm({
                        ...editForm,
                        practicalTaskTitle: event.target.value,
                      })
                    : setForm({
                        ...form,
                        practicalTaskTitle: event.target.value,
                      })
                }
                disabled={editingCompetencyId ? isSaving : false}
              />
              <TextField
                label="Deliverables"
                value={
                  editingCompetencyId
                    ? editForm.practicalTaskDeliverables
                    : form.practicalTaskDeliverables
                }
                onChange={(event) =>
                  editingCompetencyId
                    ? setEditForm({
                        ...editForm,
                        practicalTaskDeliverables: event.target.value,
                      })
                    : setForm({
                        ...form,
                        practicalTaskDeliverables: event.target.value,
                      })
                }
                disabled={editingCompetencyId ? isSaving : false}
              />
              <div className="full-span">
                <TextArea
                  label="Task instructions"
                  rows={4}
                  value={
                    editingCompetencyId
                      ? editForm.practicalTaskInstructions
                      : form.practicalTaskInstructions
                  }
                  onChange={(event) =>
                    editingCompetencyId
                      ? setEditForm({
                          ...editForm,
                          practicalTaskInstructions: event.target.value,
                        })
                      : setForm({
                          ...form,
                          practicalTaskInstructions: event.target.value,
                        })
                  }
                  disabled={editingCompetencyId ? isSaving : false}
                />
              </div>
              <div className="full-span weighted-checklist-editor">
                <TextArea
                  label="Repository review checklist"
                  rows={5}
                  value={
                    editingCompetencyId
                      ? editForm.practicalTaskChecklist
                      : form.practicalTaskChecklist
                  }
                  onChange={(event) =>
                    editingCompetencyId
                      ? setEditForm({
                          ...editForm,
                          practicalTaskChecklist: event.target.value,
                        })
                      : setForm({
                          ...form,
                          practicalTaskChecklist: event.target.value,
                        })
                  }
                  placeholder={[
                    "Project installs and runs | deployment | automated_test | 10 | 15 | Fix install/build errors.",
                    "Hidden task tests passed | testing | hidden_test | 20 | 25 | Make the code produce the expected task output.",
                    "Authentication is implemented | authentication | implementation_review | 20 | 20 | Complete login, JWT, and protected routes.",
                  ].join("\n")}
                  disabled={editingCompetencyId ? isSaving : false}
                />
                <div className="checklist-weight-meter">
                  <span>
                    Total checklist weight: {checklistWeightTotal(editingCompetencyId ? editForm.practicalTaskChecklist : form.practicalTaskChecklist)} / 100
                  </span>
                  <em>
                    Format: title | category | validation type | max score | weighted score | feedback when failed
                  </em>
                </div>
              </div>
              <TextField
                label="Instructor test command"
                value={
                  editingCompetencyId
                    ? editForm.practicalTaskTestCommand
                    : form.practicalTaskTestCommand
                }
                onChange={(event) =>
                  editingCompetencyId
                    ? setEditForm({
                        ...editForm,
                        practicalTaskTestCommand: event.target.value,
                      })
                    : setForm({
                        ...form,
                        practicalTaskTestCommand: event.target.value,
                      })
                }
                placeholder="npm test -- --runInBand tests/instructor-task.test.js"
                disabled={editingCompetencyId ? isSaving : false}
              />
              <TextField
                label="Instructor test file path"
                value={
                  editingCompetencyId
                    ? editForm.practicalTaskTestFilePath
                    : form.practicalTaskTestFilePath
                }
                onChange={(event) =>
                  editingCompetencyId
                    ? setEditForm({
                        ...editForm,
                        practicalTaskTestFilePath: event.target.value,
                      })
                    : setForm({
                        ...form,
                        practicalTaskTestFilePath: event.target.value,
                      })
                }
                placeholder="tests/instructor-task.test.js"
                disabled={editingCompetencyId ? isSaving : false}
              />
              <div className="full-span">
                <TextArea
                  label="Instructor test file content"
                  rows={8}
                  value={
                    editingCompetencyId
                      ? editForm.practicalTaskTestFileContent
                      : form.practicalTaskTestFileContent
                  }
                  onChange={(event) =>
                    editingCompetencyId
                      ? setEditForm({
                          ...editForm,
                          practicalTaskTestFileContent: event.target.value,
                        })
                      : setForm({
                          ...form,
                          practicalTaskTestFileContent: event.target.value,
                        })
                  }
                  placeholder="Add Jest, Supertest, or Playwright tests that prove the practical task works."
                  disabled={editingCompetencyId ? isSaving : false}
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
                value={
                  editingCompetencyId
                    ? editForm.theoryQuestion
                    : form.theoryQuestion
                }
                onChange={(event) =>
                  editingCompetencyId
                    ? setEditForm({
                        ...editForm,
                        theoryQuestion: event.target.value,
                      })
                    : setForm({ ...form, theoryQuestion: event.target.value })
                }
                disabled={editingCompetencyId ? isSaving : false}
              />
              <TextField
                label="Correct answer"
                value={
                  editingCompetencyId
                    ? editForm.theoryCorrectAnswer
                    : form.theoryCorrectAnswer
                }
                onChange={(event) =>
                  editingCompetencyId
                    ? setEditForm({
                        ...editForm,
                        theoryCorrectAnswer: event.target.value,
                      })
                    : setForm({
                        ...form,
                        theoryCorrectAnswer: event.target.value,
                      })
                }
                disabled={editingCompetencyId ? isSaving : false}
              />
              <div className="full-span">
                <TextArea
                  label="Multiple-choice options, one per line"
                  rows={4}
                  value={
                    editingCompetencyId
                      ? editForm.theoryOptions
                      : form.theoryOptions
                  }
                  onChange={(event) =>
                    editingCompetencyId
                      ? setEditForm({
                          ...editForm,
                          theoryOptions: event.target.value,
                        })
                      : setForm({ ...form, theoryOptions: event.target.value })
                  }
                  disabled={editingCompetencyId ? isSaving : false}
                />
              </div>
            </div>
          </div>
          <div className="full-span button-row">
            <Button type="submit" disabled={isSaving}>
              {isSaving
                ? editingCompetencyId
                  ? "Saving competency..."
                  : "Saving competency..."
                : editingCompetencyId
                  ? "Update Competency"
                  : "Add Competency"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (editingCompetencyId) {
                  setEditingCompetencyId(null);
                  resetEditForm();
                } else {
                  resetCompetencyForm();
                }
                setFormError("");
                setMessage("");
              }}
              disabled={isSaving}
            >
              {editingCompetencyId ? "Cancel" : "Clear Form"}
            </Button>
          </div>
        </form>
      </Card>
      <Card title="Current competencies" icon={<Zap size={20} />}>
        {data.length === 0 ? (
          <EmptyState message="No competencies have been added yet." />
        ) : (
          <>
            <ListToolbar
              search={competencySearch}
              onSearchChange={setCompetencySearch}
              searchPlaceholder="Search code, title, category, evidence..."
              totalCount={data.length}
              filteredCount={filteredCompetencies.length}
            >
              <SelectField
                label="Category"
                value={competencyCategoryFilter}
                onChange={(event) => setCompetencyCategoryFilter(event.target.value)}
              >
                <option value="all">All categories</option>
                {competencyCategoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </SelectField>
            </ListToolbar>
            {filteredCompetencies.length === 0 ? (
              <EmptyState message="No competencies match your search or filter." />
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
                      <th className="w-56">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompetencies.map((item) => {
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
                      <td>
                        <div className="table-action-row">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => startEditCompetency(item)}
                          disabled={isSaving || editingCompetencyId !== null}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => handleDeleteCompetency(item._id)}
                          disabled={isDeleting === item._id || isSaving}
                        >
                          {isDeleting === item._id ? "Deleting..." : "Delete"}
                        </Button>
                        </div>
                      </td>
                    </tr>
                  );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    competency: "",
    requiredScore: 80,
    level: "intermediate",
    description: "",
  });
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [benchmarkSearch, setBenchmarkSearch] = useState("");
  const [benchmarkLevelFilter, setBenchmarkLevelFilter] = useState("all");
  const benchmarkLevelOptions = useMemo(
    () => uniqueFilterOptions(benchmarks.map((item) => item.level)),
    [benchmarks],
  );
  const filteredBenchmarks = useMemo(
    () =>
      benchmarks.filter((item) => {
        const matchesLevel =
          benchmarkLevelFilter === "all" || item.level === benchmarkLevelFilter;
        return (
          matchesLevel &&
          matchesSearchTerm(
            benchmarkSearch,
            item.competency?.code,
            item.competency?.title,
            item.level,
            item.description,
            item.requiredScore,
          )
        );
      }),
    [benchmarks, benchmarkLevelFilter, benchmarkSearch],
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setMessage("");

    if (!form.competency) {
      setFormError("Please select a competency.");
      return;
    }

    setIsSaving(true);
    try {
      await api.createBenchmark(token, form);
      setMessage("Benchmark saved successfully.");
      setForm({
        competency: "",
        requiredScore: 80,
        level: "intermediate",
        description: "",
      });
      await refresh();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to create benchmark",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function startEditBenchmark(benchmark: Benchmark) {
    setEditingId(benchmark._id);
    setEditForm({
      competency: benchmark.competency._id,
      requiredScore: benchmark.requiredScore,
      level: benchmark.level,
      description: benchmark.description || "",
    });
    setFormError("");
    setMessage("");
  }

  async function handleUpdateBenchmark() {
    setFormError("");
    setMessage("");

    if (!editForm.competency) {
      setFormError("Please select a competency.");
      return;
    }

    if (!editingId) return;

    setIsSaving(true);
    try {
      await api.updateBenchmark(token, editingId, editForm);
      setEditingId(null);
      setMessage("Benchmark updated successfully.");
      await refresh();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update benchmark",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteBenchmark(benchmarkId: string) {
    if (!window.confirm("Are you sure you want to delete this benchmark?"))
      return;

    setIsDeleting(benchmarkId);
    setFormError("");
    setMessage("");

    try {
      await api.deleteBenchmark(token, benchmarkId);
      setMessage("Benchmark deleted successfully.");
      await refresh();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to delete benchmark",
      );
    } finally {
      setIsDeleting(null);
    }
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
      {formError && <Alert type="error">{formError}</Alert>}

      {editingId ? (
        <Card title="Edit benchmark" icon={<TrendingUp size={20} />}>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              handleUpdateBenchmark();
            }}
          >
            <SelectField
              label="Competency"
              value={editForm.competency}
              onChange={(event) =>
                setEditForm({ ...editForm, competency: event.target.value })
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
              value={editForm.requiredScore}
              onChange={(event) =>
                setEditForm({
                  ...editForm,
                  requiredScore: Number(event.target.value),
                })
              }
            />
            <SelectField
              label="Level"
              value={editForm.level}
              onChange={(event) =>
                setEditForm({ ...editForm, level: event.target.value })
              }
            >
              <option value="basic">Basic</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </SelectField>
            <TextField
              label="Description"
              value={editForm.description}
              onChange={(event) =>
                setEditForm({ ...editForm, description: event.target.value })
              }
            />
            <div className="form-actions">
              <Button disabled={isSaving} type="submit">
                {isSaving ? "Updating benchmark..." : "Update benchmark"}
              </Button>
              <Button
                variant="secondary"
                disabled={isSaving}
                onClick={() => setEditingId(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card title="Add benchmark" icon={<TrendingUp size={20} />}>
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
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving benchmark..." : "Save benchmark"}
            </Button>
          </form>
        </Card>
      )}

      <Card title="Active benchmarks">
        {benchmarks.length === 0 ? (
          <EmptyState message="No benchmarks found." />
        ) : (
          <>
            <ListToolbar
              search={benchmarkSearch}
              onSearchChange={setBenchmarkSearch}
              searchPlaceholder="Search competency, level, score..."
              totalCount={benchmarks.length}
              filteredCount={filteredBenchmarks.length}
            >
              <SelectField
                label="Level"
                value={benchmarkLevelFilter}
                onChange={(event) => setBenchmarkLevelFilter(event.target.value)}
              >
                <option value="all">All levels</option>
                {benchmarkLevelOptions.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </SelectField>
            </ListToolbar>
            {filteredBenchmarks.length === 0 ? (
              <EmptyState message="No benchmarks match your search or filter." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Competency</th>
                      <th>Required Score</th>
                      <th>Level</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBenchmarks.map((item) => (
                      <tr key={item._id}>
                  <td>{item.competency.title}</td>
                  <td>{formatPercent(item.requiredScore)}</td>
                  <td>{item.level}</td>
                  <td>
                    <div className="button-row">
                      <Button
                        variant="secondary"
                        onClick={() => startEditBenchmark(item)}
                        disabled={editingId !== null}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        disabled={isDeleting === item._id}
                        onClick={() => void handleDeleteBenchmark(item._id)}
                      >
                        {isDeleting === item._id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
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

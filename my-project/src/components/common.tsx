import { useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { GapLevel } from "../types";
import { gapLevelStyles } from "../utils/gapLevels";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  BarChart3,
  TrendingUp,
  Zap,
  CheckCircle,
  AlertCircle,
  Info,
  RefreshCw,
  Target,
  ClipboardCheck,
  Award,
  AlertTriangle,
  Gauge,
  Activity,
} from "lucide-react";

const toneClasses = {
  blue: "border-[#0077B6]/15 bg-gradient-to-br from-[#0077B6]/10 to-white text-[#0077B6]",
  green:
    "border-emerald-100 bg-gradient-to-br from-emerald-50 to-white text-emerald-700",
  amber:
    "border-amber-100 bg-gradient-to-br from-amber-50 to-white text-amber-700",
  red: "border-rose-100 bg-gradient-to-br from-rose-50 to-white text-rose-700",
  slate:
    "border-slate-200 bg-gradient-to-br from-slate-50 to-white text-slate-700",
};

export function Card({
  title,
  children,
  actions,
  icon,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="min-w-0 max-w-full rounded-lg border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/60 transition duration-200 hover:border-slate-300 hover:shadow-md max-[640px]:p-4">
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 max-[640px]:mb-4 max-[640px]:items-start max-[640px]:gap-3 max-[640px]:pb-4">
          {title && (
            <h2 className="flex min-w-0 items-center gap-2 text-xl font-black tracking-tight text-slate-950 max-[640px]:text-lg">
              {icon}
              <span className="min-w-0 break-words">{title}</span>
            </h2>
          )}
          {actions && <div className="max-[640px]:w-full">{actions}</div>}
        </div>
      )}
      <div className="min-w-0 max-w-full">{children}</div>
    </section>
  );
}

export function Button({
  children,
  variant = "primary",
  icon,
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variantClasses = {
    primary:
      "border-[#0077B6] bg-[#0077B6] text-white shadow-sm shadow-[#0077B6]/15 hover:border-[#0077B6] hover:bg-[#0077B6] focus-visible:ring-[#0077B6]/20",
    secondary:
      "border-slate-200 bg-white text-slate-900 shadow-sm hover:border-[#0077B6]/25 hover:bg-[#0077B6]/10 hover:text-[#0077B6] focus-visible:ring-[#0077B6]/15",
    ghost:
      "border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-slate-100",
    danger:
      "border-rose-600 bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-sm shadow-rose-900/15 hover:from-rose-700 hover:to-red-700 focus-visible:ring-rose-200",
  };

  return (
    <button
      className={`button ${variant} inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-center text-sm font-black break-words transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 max-[420px]:w-full ${variantClasses[variant]} ${className}`}
      type="button"
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

export function TextField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-2.5">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <input
        className="min-h-12 min-w-0 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#0077B6] focus:ring-4 focus:ring-[#0077B6]/15"
        {...props}
      />
    </label>
  );
}

export function TextArea({
  label,
  ...props
}: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="grid gap-2.5">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <textarea
        className="min-h-32 min-w-0 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#0077B6] focus:ring-4 focus:ring-[#0077B6]/15"
        {...props}
      />
    </label>
  );
}

export function SelectField({
  label,
  children,
  ...props
}: {
  label: string;
  children: ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="grid gap-2.5">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <select
        className="min-h-12 min-w-0 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-950 shadow-sm outline-none transition hover:border-slate-400 focus:border-[#0077B6] focus:ring-4 focus:ring-[#0077B6]/15"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Badge({
  children,
  className = "",
  tone = "neutral",
  ...props
}: {
  children: ReactNode;
  className?: string;
  tone?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  const badgeTones: Record<string, string> = {
    neutral: "border-slate-200 bg-slate-100 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
    info: "border-[#0077B6]/25 bg-[#0077B6]/10 text-[#0077B6]",
    role: "border-[#0077B6]/25 bg-[#0077B6]/15 text-[#0077B6]",
    none: "border-emerald-200 bg-emerald-50 text-emerald-700",
    low: "border-sky-200 bg-sky-50 text-sky-700",
    moderate: "border-amber-200 bg-amber-50 text-amber-700",
    high: "border-rose-200 bg-rose-50 text-rose-700",
    "gap-no": "border-emerald-200 bg-emerald-50 text-emerald-700",
    "gap-very-low": "border-[#0077B6]/25 bg-[#0077B6]/10 text-[#0077B6]",
    "gap-low": "border-sky-200 bg-sky-50 text-sky-700",
    "gap-moderate": "border-amber-200 bg-amber-50 text-amber-700",
    "gap-high": "border-rose-200 bg-rose-50 text-rose-700",
    "gap-neutral": "border-slate-200 bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`badge ${tone} inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1 text-xs font-black break-words shadow-sm ${badgeTones[tone] || badgeTones.neutral} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}

export function GapBadge({ level }: { level: GapLevel }) {
  return <Badge tone={gapLevelStyles[level]}>{level}</Badge>;
}

export function StatCard({
  label,
  value,
  helper,
  icon,
  tone = "blue",
}: {
  label: string;
  value: ReactNode;
  helper?: string;
  icon?: ReactNode;
  tone?: "blue" | "green" | "amber" | "red" | "slate";
}) {
  return (
    <div
      className={`relative min-h-36 min-w-0 max-w-full overflow-hidden rounded-lg border p-6 shadow-sm shadow-slate-200/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-md max-[640px]:p-4 ${toneClasses[tone]}`}
    >
      <span className="absolute right-0 top-0 h-20 w-20 -translate-y-8 translate-x-8 rounded-full bg-current opacity-10" />
      {icon && (
        <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white/85 shadow-sm ring-1 ring-black/5 max-[640px]:mb-4">
          {icon}
        </div>
      )}
      <span className="block break-words text-sm font-black text-slate-500">{label}</span>
      <strong className="mt-1 block break-words text-3xl font-black text-slate-950 max-[640px]:text-2xl">{value}</strong>
      {helper && <small className="mt-2 block break-words text-sm font-bold text-slate-500">{helper}</small>}
    </div>
  );
}

export function ProgressBar({ value }: { value: number | undefined }) {
  const safeValue = Math.max(0, Math.min(value || 0, 100));
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200" aria-label={`Progress ${safeValue}%`}>
      <span
        className="block h-full rounded-full bg-gradient-to-r from-[#0077B6] to-emerald-500"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

export function Alert({
  type,
  children,
}: {
  type: "success" | "error" | "info";
  children: ReactNode;
}) {
  const iconMap = {
    success: <CheckCircle size={20} />,
    error: <AlertCircle size={20} />,
    info: <Info size={20} />,
  };
  const alertClasses = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-rose-200 bg-rose-50 text-rose-800",
    info: "border-[#0077B6]/25 bg-[#0077B6]/10 text-[#0077B6]",
  };

  return (
    <div
      className={`flex min-w-0 max-w-full items-start gap-3 rounded-lg border p-4 text-sm font-bold break-words shadow-sm ${alertClasses[type]}`}
    >
      {iconMap[type]}
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="min-w-0 max-w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center font-bold text-slate-500 break-words">{message}</div>;
}

export function ReadMoreText({
  text,
  limit = 180,
  className = "",
  buttonClassName = "",
  emptyText = "No details available.",
}: {
  text?: string | null;
  limit?: number;
  className?: string;
  buttonClassName?: string;
  emptyText?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const content = String(text || "").trim();
  const shouldCollapse = content.length > limit;
  const visibleText = useMemo(() => {
    if (!content) return emptyText;
    if (!shouldCollapse || isExpanded) return content;
    return `${content.slice(0, limit).trim()}...`;
  }, [content, emptyText, isExpanded, limit, shouldCollapse]);

  return (
    <div className={`read-more-text ${className}`.trim()}>
      <p>{visibleText}</p>
      {shouldCollapse && (
        <button
          className={`read-more-toggle ${buttonClassName}`.trim()}
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}

export function LoadingState({
  message = "Loading data...",
}: {
  message?: string;
}) {
  return (
    <div
      className="flex min-w-0 max-w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 font-bold text-slate-500 shadow-sm"
    >
      <RefreshCw className="animate-spin" size={20} />
      {message}
    </div>
  );
}

type ChartDatum = Record<string, string | number | null | undefined>;

function ChartShell({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 max-w-full rounded-lg border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/60 max-[640px]:p-3">
      {title && <h3 className="mb-4 break-words text-base font-extrabold text-slate-950 max-[640px]:mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={220}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

// Chart Components
export function BarChartComponent({
  data,
  dataKey,
  xAxisKey,
  title,
  color = "#0077B6",
}: {
  data: ChartDatum[];
  dataKey: string;
  xAxisKey: string;
  title?: string;
  color?: string;
}) {
  return (
    <ChartShell title={title}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" vertical={false} />
          <XAxis dataKey={xAxisKey} interval="preserveStartEnd" tick={{ fontSize: 11 }} />
          <YAxis width={36} tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: "rgba(0, 119, 182, 0.08)" }} />
          <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} />
        </BarChart>
    </ChartShell>
  );
}

export function LineChartComponent({
  data,
  dataKey,
  xAxisKey,
  title,
  color = "#10b981",
}: {
  data: ChartDatum[];
  dataKey: string;
  xAxisKey: string;
  title?: string;
  color?: string;
}) {
  return (
    <ChartShell title={title}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" vertical={false} />
          <XAxis dataKey={xAxisKey} interval="preserveStartEnd" tick={{ fontSize: 11 }} />
          <YAxis width={36} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            dot={{ fill: color, r: 5 }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
    </ChartShell>
  );
}

export function PieChartComponent({
  data,
  dataKey,
  nameKey,
  title,
  colors = ["#0077B6", "#10b981", "#1f2937", "#0077B6", "#34d399"],
}: {
  data: ChartDatum[];
  dataKey: string;
  nameKey: string;
  title?: string;
  colors?: string[];
}) {
  return (
    <ChartShell title={title}>
        <PieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius="70%"
            label
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors[index % colors.length]}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
    </ChartShell>
  );
}

export function IconBadge({
  icon: Icon,
  tone = "blue",
}: {
  icon: LucideIcon;
  tone?: "blue" | "green" | "amber" | "red" | "slate";
}) {
  return (
    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border shadow-sm ${toneClasses[tone]}`}>
      <Icon size={18} aria-hidden="true" />
    </span>
  );
}

// Icon exports for easy access
export {
  Users,
  BarChart3,
  TrendingUp,
  Zap,
  CheckCircle,
  AlertCircle,
  Info,
  RefreshCw,
  Target,
  ClipboardCheck,
  Award,
  AlertTriangle,
  Gauge,
  Activity,
};

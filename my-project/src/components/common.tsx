import type { ReactNode } from 'react'
import type { GapLevel } from '../types'
import { gapLevelStyles } from '../utils/gapLevels'

export function Card({
  title,
  children,
  actions,
}: {
  title?: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-header">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function Button({
  children,
  variant = 'primary',
  ...props
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`button ${variant}`} type="button" {...props}>
      {children}
    </button>
  )
}

export function TextField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  )
}

export function TextArea({
  label,
  ...props
}: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea {...props} />
    </label>
  )
}

export function SelectField({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="field">
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  )
}

export function Badge({
  children,
  className = '',
  tone = 'neutral',
  ...props
}: {
  children: ReactNode
  className?: string
  tone?: string
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`badge ${tone} ${className}`.trim()} {...props}>
      {children}
    </span>
  )
}

export function GapBadge({ level }: { level: GapLevel }) {
  return <Badge tone={gapLevelStyles[level]}>{level}</Badge>
}

export function StatCard({
  label,
  value,
  helper,
}: {
  label: string
  value: ReactNode
  helper?: string
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper && <small>{helper}</small>}
    </div>
  )
}

export function ProgressBar({ value }: { value: number | undefined }) {
  const safeValue = Math.max(0, Math.min(value || 0, 100))
  return (
    <div className="progress" aria-label={`Progress ${safeValue}%`}>
      <span style={{ width: `${safeValue}%` }} />
    </div>
  )
}

export function Alert({
  type,
  children,
}: {
  type: 'success' | 'error' | 'info'
  children: ReactNode
}) {
  return <div className={`alert ${type}`}>{children}</div>
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>
}

export function LoadingState({ message = 'Loading data...' }: { message?: string }) {
  return <div className="loading-state">{message}</div>
}

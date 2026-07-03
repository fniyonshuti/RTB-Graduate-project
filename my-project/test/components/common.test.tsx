import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button, GapBadge, ProgressBar, TextField } from '../../src/components/common'

describe('common components', () => {
  it('renders buttons with the requested variant while preserving button defaults', () => {
    render(<Button variant="secondary">Review</Button>)

    const button = screen.getByRole('button', { name: 'Review' })
    expect(button).toHaveClass('button', 'secondary')
    expect(button).toHaveAttribute('type', 'button')
  })

  it('associates text fields with their labels', () => {
    render(<TextField label="Email" value="" onChange={() => {}} />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('clamps progress bar values to a safe visual range', () => {
    const { rerender } = render(<ProgressBar value={125} />)

    expect(screen.getByLabelText('Progress 100%').firstElementChild).toHaveStyle({
      width: '100%',
    })

    rerender(<ProgressBar value={-10} />)
    expect(screen.getByLabelText('Progress 0%').firstElementChild).toHaveStyle({
      width: '0%',
    })
  })

  it('renders the correct gap badge tone', () => {
    render(<GapBadge level="High Gap" />)

    expect(screen.getByText('High Gap')).toHaveClass('badge', 'gap-high')
  })
})

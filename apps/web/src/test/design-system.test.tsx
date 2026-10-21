import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'

describe('design system primitives', () => {
  it('renders a badge with its state variant', () => {
    render(<Badge variant="success-light">Live</Badge>)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('renders a button with its variant', () => {
    render(<Button variant="outline">Browse tournaments</Button>)
    const button = screen.getByRole('button', { name: 'Browse tournaments' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('data-slot', 'button')
  })
})

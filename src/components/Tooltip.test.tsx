import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Tooltip from './Tooltip'

describe('Tooltip Component', () => {
  it('should render children', () => {
    render(
      <Tooltip content="Tooltip text">
        <span>Hover target</span>
      </Tooltip>
    )
    expect(screen.getByText('Hover target')).toBeTruthy()
  })

  it('should render tooltip content', () => {
    render(
      <Tooltip content="Tooltip text">
        <span>Hover target</span>
      </Tooltip>
    )
    expect(screen.getByText('Tooltip text')).toBeTruthy()
  })

  it('should apply position class', () => {
    const { container } = render(
      <Tooltip content="Test" position="left">
        <span>Target</span>
      </Tooltip>
    )
    expect(container.querySelector('.tooltip-left')).toBeTruthy()
  })

  it('should not render tooltip when show is false', () => {
    const { container } = render(
      <Tooltip content="Test" show={false}>
        <span>Target</span>
      </Tooltip>
    )
    expect(container.querySelector('.tooltip')).toBeFalsy()
  })

  it('should render complex content', () => {
    render(
      <Tooltip content={<><strong>Role</strong><p>Task</p></>}>
        <span>Target</span>
      </Tooltip>
    )
    expect(screen.getByText('Role')).toBeTruthy()
    expect(screen.getByText('Task')).toBeTruthy()
  })
})

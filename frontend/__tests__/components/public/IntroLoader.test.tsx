import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import IntroLoader from '../../../components/public/IntroLoader';

describe('IntroLoader Navigation & Refresh Behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    delete (window as any).__gs_intro_shown;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).__gs_intro_shown;
  });

  it('renders intro animation on initial website load or page refresh', () => {
    render(<IntroLoader />);

    // Should render the intro aside and text
    expect(screen.getByRole('complementary', { name: /Loading GateSphere/i })).toBeInTheDocument();
    expect(screen.getByText('GateSphere')).toBeInTheDocument();
    expect(screen.getByText(/Smart Community Platform/i)).toBeInTheDocument();
  });

  it('sets session flag after playing and does not re-render on subsequent client-side navigation', () => {
    const onReady = vi.fn();
    const { unmount } = render(<IntroLoader onReady={onReady} />);

    // Fast-forward timers past exit (700ms) and removal (1150ms)
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(onReady).toHaveBeenCalled();
    expect((window as any).__gs_intro_shown).toBe(true);

    unmount();

    // Now simulate navigating to another page (like clicking navbar button) by mounting IntroLoader again
    const { container } = render(<IntroLoader />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('complementary', { name: /Loading GateSphere/i })).not.toBeInTheDocument();
  });

  it('renders animation again if page is refreshed (session flag reset)', () => {
    // Simulating initial load
    const { unmount } = render(<IntroLoader />);
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    unmount();

    // Simulating browser page reload / refresh: window state is cleared
    delete (window as any).__gs_intro_shown;

    render(<IntroLoader />);
    expect(screen.getByRole('complementary', { name: /Loading GateSphere/i })).toBeInTheDocument();
  });
});

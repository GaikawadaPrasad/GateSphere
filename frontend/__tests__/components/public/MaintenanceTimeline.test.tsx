import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import MaintenanceTimeline from '../../../components/public/MaintenanceTimeline';

// Mock IntersectionObserver used by useReveal
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(window as any).IntersectionObserver = MockIntersectionObserver;

describe('MaintenanceTimeline', () => {
  let mockMatchMedia: any;

  beforeEach(() => {
    // Mock matchMedia for prefers-reduced-motion
    mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });

    // Mock requestAnimationFrame to execute synchronously
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial state correctly with step 1 active', () => {
    render(<MaintenanceTimeline />);
    
    // Initial step badge & text
    expect(screen.getAllByText('Resident Reports').length).toBeGreaterThan(0);
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('updates active step when a node is clicked', () => {
    render(<MaintenanceTimeline />);
    
    // Click the 3rd step button (index 2) "Technician Works"
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(buttons[2]);

    // Should now show step 3 active text
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
    expect(screen.getByText(/Cartridge valve replaced/)).toBeInTheDocument();
  });

  it('respects prefers-reduced-motion correctly', () => {
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    
    const { container } = render(<MaintenanceTimeline />);
    
    // Since reduced motion is true, the ambient glows shouldn't be rendered
    const glowElements = container.querySelectorAll('.blur-3xl');
    expect(glowElements.length).toBe(0);
  });
});

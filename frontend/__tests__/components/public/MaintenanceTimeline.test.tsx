import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MaintenanceTimeline from '../../../components/public/MaintenanceTimeline';

// Mock IntersectionObserver used by useReveal
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(window as any).IntersectionObserver = MockIntersectionObserver;

describe('MaintenanceTimeline', () => {
  let mockMatchMedia: jest.Mock;

  beforeEach(() => {
    // Mock matchMedia for prefers-reduced-motion
    mockMatchMedia = jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });

    // Mock requestAnimationFrame to execute synchronously
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders initial state correctly with step 1 active', () => {
    render(<MaintenanceTimeline />);
    
    // Initial step title is "Resident Reports"
    expect(screen.getByText('Resident Reports')).toBeInTheDocument();
    
    // Verify initial UI elements
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('updates active step when a node is clicked', () => {
    render(<MaintenanceTimeline />);
    
    // Click the 3rd step (index 2) "Technician Works"
    const step3Button = screen.getByText('Technician Works').closest('button');
    expect(step3Button).not.toBeNull();
    fireEvent.click(step3Button!);

    // Should now show step 3 active text
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
    expect(screen.getByText('Cartridge Replaced & Leak Sealed')).toBeInTheDocument();
  });

  it('handles scroll events to update progress', () => {
    const { container } = render(<MaintenanceTimeline />);
    const section = container.querySelector('section');
    
    if (section) {
      // Mock getBoundingClientRect to simulate scrolling
      jest.spyOn(section, 'getBoundingClientRect').mockReturnValue({
        top: -1000,
        height: 3000,
        bottom: 2000,
        left: 0,
        right: 1000,
        width: 1000,
        x: 0,
        y: -1000,
        toJSON: () => {}
      });
      
      // We need window.innerHeight for calculation
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1000 });
      
      // Fire scroll event
      fireEvent.scroll(window);
      
      // With top: -1000, height: 3000, window: 1000 -> totalH = 2000, current = 1000 -> progress = 0.5
      // Math.floor(0.5 * 5) = 2 (Step 3)
      expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
    }
  });

  it('respects prefers-reduced-motion correctly', () => {
    mockMatchMedia.mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    
    const { container } = render(<MaintenanceTimeline />);
    
    // Since reduced motion is true, the ambient glows shouldn't be rendered
    // The ambient glow div has absolute, -top-24, blur-3xl classes
    const glowElements = container.querySelectorAll('.blur-3xl');
    expect(glowElements.length).toBe(0);
  });
});

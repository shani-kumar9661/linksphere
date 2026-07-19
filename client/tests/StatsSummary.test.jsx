import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatsSummary from '../src/components/StatsSummary';

describe('StatsSummary Component Tests', () => {
  test('should render 0 links and 0 clicks when urls array is empty', () => {
    render(<StatsSummary urls={[]} />);
    
    expect(screen.getByText('Total Links')).toBeInTheDocument();
    expect(screen.getByText('Total Click Traffic')).toBeInTheDocument();
    
    // Both values are '0'
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBe(2);
  });

  test('should correctly count links and sum clicks', () => {
    const mockUrls = [
      { id: '1', clicks: 12 },
      { id: '2', clicks: 5 },
      { id: '3', clicks: 0 },
      { id: '4', clicks: 3 }
    ];

    render(<StatsSummary urls={mockUrls} />);

    // Total links should be 4
    expect(screen.getByText('4')).toBeInTheDocument();
    // Total clicks should be 20 (12 + 5 + 0 + 3)
    expect(screen.getByText('20')).toBeInTheDocument();
  });
});

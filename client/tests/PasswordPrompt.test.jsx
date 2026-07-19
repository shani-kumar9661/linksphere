import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PasswordPrompt from '../src/components/PasswordPrompt';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ shortCode: 'abc123' })
}));

describe('PasswordPrompt Component Tests', () => {
  let originalLocation;

  beforeEach(() => {
    originalLocation = window.location;
    // Mock window.location.replace
    delete window.location;
    window.location = { replace: vi.fn() };
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.restoreAllMocks();
  });

  test('should render password prompt form correctly', () => {
    render(<PasswordPrompt />);
    expect(screen.getByText('Password Required')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Access Link/i })).toBeInTheDocument();
  });

  test('should show error when password validation fails on empty input', async () => {
    render(<PasswordPrompt />);
    
    // Trigger submit on form
    const form = screen.getByRole('button', { name: /Access Link/i }).closest('form');
    fireEvent.submit(form);

    expect(await screen.findByText('Please enter the password.')).toBeInTheDocument();
  });

  test('should verify password and redirect on successful submit', async () => {
    const mockOriginalUrl = 'https://github.com/google';
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        data: { originalUrl: mockOriginalUrl }
      })
    });

    render(<PasswordPrompt />);

    const passwordInput = screen.getByPlaceholderText('••••••••');
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /Access Link/i });
    fireEvent.click(submitButton);

    expect(screen.getByText('Verifying...')).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/urls/verify-password/abc123', expect.any(Object));
      expect(window.location.replace).toHaveBeenCalledWith(mockOriginalUrl);
    });
  });

  test('should show error message when api call fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        status: 'fail',
        message: 'Incorrect password entered.'
      })
    });

    render(<PasswordPrompt />);

    const passwordInput = screen.getByPlaceholderText('••••••••');
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

    const submitButton = screen.getByRole('button', { name: /Access Link/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Incorrect password entered.')).toBeInTheDocument();
    });
  });
});

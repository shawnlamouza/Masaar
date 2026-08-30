import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

describe('Masaar application shell', () => {
  it('starts with a role-aware Masaar sign-in and Joe as the owner demo', () => {
    sessionStorage.clear();
    render(<App />);
    expect(screen.getByRole('heading', { name: /run the business/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('joe@masaar.demo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /rami · employee/i }));
    expect(screen.getByDisplayValue('employee@masaar.demo')).toBeInTheDocument();
  });
});

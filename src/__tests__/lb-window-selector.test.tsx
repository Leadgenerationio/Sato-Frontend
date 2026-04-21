import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LbWindowSelector } from '../components/shared/lb-window-selector';

describe('LbWindowSelector', () => {
  it('renders all seven Sam-required time slices', () => {
    render(<LbWindowSelector value="today" onChange={() => {}} />);
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.getByText('This Week')).toBeTruthy();
    expect(screen.getByText('Last Week')).toBeTruthy();
    expect(screen.getByText('This Month')).toBeTruthy();
    expect(screen.getByText('Last Month')).toBeTruthy();
    expect(screen.getByText('Year to Date')).toBeTruthy();
  });

  it('marks the active window with aria-pressed=true', () => {
    render(<LbWindowSelector value="this_month" onChange={() => {}} />);
    const monthBtn = screen.getByTestId('lb-window-this_month');
    expect(monthBtn.getAttribute('aria-pressed')).toBe('true');
    const todayBtn = screen.getByTestId('lb-window-today');
    expect(todayBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('fires onChange with the clicked window', () => {
    const onChange = vi.fn();
    render(<LbWindowSelector value="today" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('lb-window-ytd'));
    expect(onChange).toHaveBeenCalledWith('ytd');
  });
});

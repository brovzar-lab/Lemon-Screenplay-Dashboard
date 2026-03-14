/**
 * ToastContainer.test.tsx
 *
 * Tests for the toast notification UI component.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastContainer } from './ToastContainer';
import { useToastStore } from '@/stores/toastStore';

describe('ToastContainer', () => {
    beforeEach(() => {
        // Reset store state between tests
        useToastStore.setState({ toasts: [] });
    });

    it('renders nothing when store has no toasts', () => {
        const { container } = render(<ToastContainer />);
        expect(container.firstChild).toBeNull();
    });

    it('renders a toast when one is added to the store', () => {
        useToastStore.getState().addToast('Test error');
        render(<ToastContainer />);

        expect(screen.getByText(/Test error/)).toBeInTheDocument();
    });

    it('renders max 3 toasts and shows overflow indicator when 4+ toasts exist', () => {
        // Add 5 toasts
        for (let i = 1; i <= 5; i++) {
            useToastStore.getState().addToast(`Toast ${i}`);
        }

        render(<ToastContainer />);

        // Should show 3 toasts (the newest 3)
        const alerts = screen.getAllByRole('alert');
        expect(alerts).toHaveLength(3);

        // Overflow text should appear: 5 - 3 = 2 more
        expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
    });

    it('each toast has role="alert" attribute', () => {
        useToastStore.getState().addToast('Alert toast');
        render(<ToastContainer />);

        const alerts = screen.getAllByRole('alert');
        expect(alerts).toHaveLength(1);
    });

    it('clicking dismiss button removes the toast', () => {
        useToastStore.getState().addToast('Dismissable toast');
        render(<ToastContainer />);

        expect(screen.getByText(/Dismissable toast/)).toBeInTheDocument();

        const dismissButton = screen.getByLabelText('Dismiss toast');
        fireEvent.click(dismissButton);

        expect(screen.queryByText(/Dismissable toast/)).not.toBeInTheDocument();
    });

    it('error toast has red border class, warning toast has amber border class', () => {
        useToastStore.getState().addToast('Error toast', 'error');
        useToastStore.getState().addToast('Warning toast', 'warning');

        render(<ToastContainer />);

        const alerts = screen.getAllByRole('alert');
        // Newest are shown, so both should be visible (only 2 toasts, under MAX_VISIBLE)
        const errorAlert = alerts.find(a => a.textContent?.includes('Error toast'));
        const warningAlert = alerts.find(a => a.textContent?.includes('Warning toast'));

        expect(errorAlert?.className).toContain('border-l-red-500');
        expect(warningAlert?.className).toContain('border-l-amber-500');
    });
});

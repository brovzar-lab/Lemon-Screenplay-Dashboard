/**
 * ToastContainer Component
 *
 * Renders toast notifications at the bottom-center of the viewport.
 * Subscribes to the toastStore for state. Shows max 3 toasts with overflow indicator.
 * Glassmorphism styling matching the project's premium dark theme.
 */

import { useToastStore, MAX_VISIBLE } from '@/stores/toastStore';

export function ToastContainer() {
    const toasts = useToastStore((s) => s.toasts);
    const removeToast = useToastStore((s) => s.removeToast);

    if (toasts.length === 0) {
        return null;
    }

    const visibleToasts = toasts.slice(-MAX_VISIBLE);
    const overflowCount = toasts.length - MAX_VISIBLE;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse gap-2 items-center">
            {visibleToasts.map((toast, index) => {
                const isLastVisible = index === visibleToasts.length - 1;
                const showOverflow = isLastVisible && overflowCount > 0;

                const borderColor =
                    toast.severity === 'warning'
                        ? 'border-l-amber-500'
                        : 'border-l-red-500';

                return (
                    <div
                        key={toast.id}
                        role="alert"
                        aria-live="assertive"
                        className={`backdrop-blur-md bg-black/70 border border-white/10 rounded-lg px-4 py-3 shadow-lg min-w-[320px] max-w-[480px] flex items-start gap-3 border-l-4 ${borderColor} animate-[slideUp_0.3s_ease-out]`}
                    >
                        <span className="text-white/90 text-sm flex-1">
                            {toast.message}
                            {showOverflow && (
                                <span className="text-white/50 ml-1">
                                    (+{overflowCount} more)
                                </span>
                            )}
                        </span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="text-white/50 hover:text-white/80 shrink-0 cursor-pointer"
                            aria-label="Dismiss toast"
                        >
                            &#x2715;
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

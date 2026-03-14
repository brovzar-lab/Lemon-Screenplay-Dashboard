/**
 * SharedViewPage
 *
 * Lazy-loaded page for the /share/:token route.
 * Resolves the share token and displays a branded read-only
 * analysis view for partners — no dashboard chrome, no auth required.
 *
 * BUNDLE ISOLATION: Only imports from @/lib/shareService, @/components/share,
 * and @/components/ui. Never imports stores, hooks, or dashboard components.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { resolveShareToken } from '@/lib/shareService';
import type { SharedViewDocument } from '@/lib/shareService';
import { LoadingFallback } from '@/components/ui';
import { SharedViewLayout, ExpiredLinkPage } from '@/components/share';

type ViewState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'ready'; data: SharedViewDocument };

export default function SharedViewPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ViewState>({ status: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ status: 'not_found' });
      return;
    }

    let cancelled = false;

    async function resolve() {
      try {
        const data = await resolveShareToken(token!);
        if (cancelled) return;

        if (!data) {
          setState({ status: 'not_found' });
        } else {
          setState({ status: 'ready', data });
        }
      } catch {
        if (!cancelled) {
          setState({ status: 'not_found' });
        }
      }
    }

    resolve();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-black-900 flex items-center justify-center">
        <LoadingFallback />
      </div>
    );
  }

  if (state.status === 'not_found') {
    return <ExpiredLinkPage />;
  }

  return <SharedViewLayout data={state.data} />;
}

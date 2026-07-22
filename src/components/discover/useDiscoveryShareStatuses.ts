import { useEffect } from 'react';
import { getAllSharedViews } from '@/lib/shareService';
import { useShareStore } from '@/stores/shareStore';

function isActiveShare(expiresAt?: string): boolean {
  if (!expiresAt) return true;
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry >= Date.now();
}

export function useDiscoveryShareStatuses() {
  useEffect(() => {
    let cancelled = false;

    getAllSharedViews()
      .then((views) => {
        if (cancelled) return;

        views
          .filter((view) => isActiveShare(view.expiresAt))
          .forEach((view) => {
            useShareStore.getState().setToken(view.screenplayId, view);
          });
      })
      .catch(() => {
        // Sharing remains available in the drawer even if status preload fails.
      });

    return () => {
      cancelled = true;
    };
  }, []);
}

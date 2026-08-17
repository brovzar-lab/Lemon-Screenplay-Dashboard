import { useMemo } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
  ProjectWorkspace,
  ProjectWorkspaceState,
  type ProjectWorkspaceTab,
  ScreenplayFileWorkspace,
  type ScreenplayFileTab,
} from '@/components/project';
import '@/components/discover/discovery.css';
import { useLiveScreenplaySync, useScreenplays } from '@/hooks/useScreenplays';
import { getScreenplayStats } from '@/lib/api';

interface WorkspaceNavigationState {
  fromDiscovery?: boolean;
}

function ProjectWorkspacePage() {
  const { t } = useTranslation();
  const { projectId, section } = useParams<{ projectId: string; section?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: screenplays = [], isLoading, error } = useScreenplays();

  useLiveScreenplaySync();

  const stats = useMemo(() => getScreenplayStats(screenplays), [screenplays]);
  const screenplay = useMemo(
    () => screenplays.find(
      (candidate) => candidate.projectId === projectId || candidate.id === projectId,
    ),
    [projectId, screenplays],
  );
  const activeTab: ProjectWorkspaceTab = isProjectWorkspaceTab(section)
    ? section
    : 'overview';
  const screenplayFileEnabled = searchParams.get('workspace') === 'screenplay';
  const screenplayFileTab: ScreenplayFileTab = isScreenplayFileTab(section)
    ? section
    : 'overview';

  const goBack = () => {
    const state = location.state as WorkspaceNavigationState | null;
    if (state?.fromDiscovery) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  if (isLoading) {
    return (
      <ProjectWorkspaceState
        title={t('Opening the project workspace')}
        message={t('Loading the latest screenplay decision and its sealed reader evidence.')}
        stats={stats}
        loading
      />
    );
  }

  if (error) {
    return (
      <ProjectWorkspaceState
        title={t('The project could not be loaded')}
        message={t('Discovery still has the last known slate. Return there and try opening this project again.')}
        stats={stats}
        onBack={goBack}
      />
    );
  }

  if (!screenplay) {
    return (
      <ProjectWorkspaceState
        title={t('This project is not in the slate')}
        message={t('It may have been removed, renamed, or linked with an older project address.')}
        stats={stats}
        onBack={goBack}
      />
    );
  }

  const selectTab = (tab: ProjectWorkspaceTab) => {
    const stableProjectId = screenplay.projectId ?? screenplay.id;
    navigate(
      tab === 'overview'
        ? `/projects/${stableProjectId}`
        : `/projects/${stableProjectId}/${tab}`,
      { replace: false },
    );
  };

  const selectScreenplayFileTab = (tab: ScreenplayFileTab) => {
    const stableProjectId = screenplay.projectId ?? screenplay.id;
    navigate(
      tab === 'overview'
        ? `/projects/${stableProjectId}?workspace=screenplay`
        : `/projects/${stableProjectId}/${tab}?workspace=screenplay`,
      { replace: true },
    );
  };

  if (screenplayFileEnabled) {
    return (
      <ScreenplayFileWorkspace
        screenplay={screenplay}
        activeTab={screenplayFileTab}
        onSelectTab={selectScreenplayFileTab}
        onBack={goBack}
      />
    );
  }

  return (
    <ProjectWorkspace
      screenplay={screenplay}
      stats={stats}
      activeTab={activeTab}
      onSelectTab={selectTab}
      onBack={goBack}
    />
  );
}

function isScreenplayFileTab(value: string | undefined): value is ScreenplayFileTab {
  return value === 'overview'
    || value === 'scores'
    || value === 'reader-room'
    || value === 'story-x-ray'
    || value === 'producer-take'
    || value === 'notes-files';
}

function isProjectWorkspaceTab(value: string | undefined): value is ProjectWorkspaceTab {
  return value === 'overview'
    || value === 'reader-room'
    || value === 'story-x-ray'
    || value === 'producer-take'
    || value === 'notes-files';
}

export default ProjectWorkspacePage;

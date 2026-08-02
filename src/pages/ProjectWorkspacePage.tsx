import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { ProjectWorkspace, ProjectWorkspaceState } from '@/components/project';
import '@/components/discover/discovery.css';
import { useLiveScreenplaySync, useScreenplays } from '@/hooks/useScreenplays';
import { getScreenplayStats } from '@/lib/api';

interface WorkspaceNavigationState {
  fromDiscovery?: boolean;
}

function ProjectWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: screenplays = [], isLoading, error } = useScreenplays();

  useLiveScreenplaySync();

  const stats = useMemo(() => getScreenplayStats(screenplays), [screenplays]);
  const screenplay = useMemo(
    () => screenplays.find(
      (candidate) => candidate.projectId === projectId || candidate.id === projectId,
    ),
    [projectId, screenplays],
  );

  const goBack = () => {
    const state = location.state as WorkspaceNavigationState | null;
    if (state?.fromDiscovery) {
      navigate(-1);
    } else {
      navigate('/discover');
    }
  };

  if (isLoading) {
    return (
      <ProjectWorkspaceState
        title="Opening the project workspace"
        message="Loading the latest screenplay decision and its sealed reader evidence."
        stats={stats}
        loading
      />
    );
  }

  if (error) {
    return (
      <ProjectWorkspaceState
        title="The project could not be loaded"
        message="Discovery still has the last known slate. Return there and try opening this project again."
        stats={stats}
        onBack={goBack}
      />
    );
  }

  if (!screenplay) {
    return (
      <ProjectWorkspaceState
        title="This project is not in the slate"
        message="It may have been removed, renamed, or linked with an older project address."
        stats={stats}
        onBack={goBack}
      />
    );
  }

  return <ProjectWorkspace screenplay={screenplay} stats={stats} onBack={goBack} />;
}

export default ProjectWorkspacePage;

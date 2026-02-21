import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ManualDesignerPage } from '../components/editor/ManualDesignerPage';
import { useProjectStore } from '../data/store';
import { useProjectsStore } from '../state/projectsStore';
import { useToast } from '../components/ui/ToastProvider';

function isValidCharIdForBlocks(
  charId: string,
  charactersByBlock: ReturnType<typeof useProjectStore.getState>['charactersByBlock']
) {
  return Object.values(charactersByBlock).some((chars) => chars.some((char) => char.id === charId));
}

export function ManualEditorRoutePage() {
  const navigate = useNavigate();
  const { projectId, charId, editorMode } = useParams<{
    projectId: string;
    charId: string;
    editorMode?: string;
  }>();
  const charactersByBlock = useProjectStore((state) => state.charactersByBlock);
  const currentProjectId = useProjectsStore((state) => state.currentProjectId);
  const loading = useProjectsStore((state) => state.loading);
  const openProject = useProjectsStore((state) => state.openProject);
  const { notify } = useToast();

  useEffect(() => {
    if (!projectId || projectId === 'new') return;
    if (currentProjectId === projectId) return;
    void openProject(projectId);
  }, [currentProjectId, openProject, projectId]);

  const isProjectReady = useMemo(() => {
    if (!projectId || projectId === 'new') return false;
    return currentProjectId === projectId;
  }, [currentProjectId, projectId]);

  const hasValidRouteParams = useMemo(() => {
    if (!projectId || projectId === 'new' || !charId || !isProjectReady) return false;
    return isValidCharIdForBlocks(charId, charactersByBlock);
  }, [charactersByBlock, charId, isProjectReady, projectId]);
  const resolvedMode = editorMode === 'shape' ? 'shape' : 'module';
  const hasInvalidMode = editorMode != null && editorMode !== 'module' && editorMode !== 'shape';

  useEffect(() => {
    if (!projectId || projectId === 'new' || !charId) return;
    if (!isProjectReady || loading) return;
    if (hasInvalidMode) {
      notify({
        variant: 'error',
        title: 'Invalid editor mode',
        description: 'Switching back to module mode.',
      });
      navigate(`/projects/${projectId}/manual/${charId}/module`, { replace: true });
      return;
    }
    if (!editorMode) {
      navigate(`/projects/${projectId}/manual/${charId}/module`, { replace: true });
    }
  }, [charId, editorMode, hasInvalidMode, isProjectReady, loading, navigate, notify, projectId]);

  useEffect(() => {
    if (!projectId || projectId === 'new' || !charId) return;
    if (!isProjectReady || loading) return;
    if (hasValidRouteParams) return;
    notify({
      variant: 'error',
      title: 'Character not found',
      description: 'Returning to designer.',
    });
    navigate(`/projects/${projectId}`, { replace: true });
  }, [charId, hasValidRouteParams, isProjectReady, loading, navigate, notify, projectId]);

  if (!projectId || projectId === 'new' || !charId) {
    return null;
  }

  if (!isProjectReady || loading) {
    return null;
  }

  if (!hasValidRouteParams) {
    return null;
  }

  return (
    <ManualDesignerPage
      projectId={projectId}
      charId={charId}
      mode={resolvedMode}
      onSwitchMode={(nextMode) => navigate(`/projects/${projectId}/manual/${charId}/${nextMode}`)}
      onBack={() => navigate(`/projects/${projectId}`)}
    />
  );
}

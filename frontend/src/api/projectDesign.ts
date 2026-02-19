import { http } from '../lib/http';

export interface ProjectDesignSettingsDto {
  projectId: string;
  depthInches: number;
  selectedModuleId: string;
  showDimensions: boolean;
  dimensionUnit: 'mm' | 'in';
  defaultLedCount: number;
  defaultLedColumns: number;
  defaultLedOrientation: 'horizontal' | 'vertical' | 'auto';
}

export async function getProjectDesignSettings(accessToken: string, projectId: string) {
  return http<ProjectDesignSettingsDto>(`/projects/${projectId}/design-settings`, {
    method: 'GET',
    accessToken,
  });
}

export async function patchProjectDesignSettings(
  accessToken: string,
  projectId: string,
  patch: Partial<ProjectDesignSettingsDto>
) {
  return http<ProjectDesignSettingsDto>(`/projects/${projectId}/design-settings`, {
    method: 'PATCH',
    body: patch,
    accessToken,
  });
}

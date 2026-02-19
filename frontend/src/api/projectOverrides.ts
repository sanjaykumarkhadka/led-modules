import { http } from '../lib/http';

export interface CharacterOverrideDto {
  projectId: string;
  characterId: string;
  ledCount?: number;
  ledColumns?: number;
  ledOrientation?: 'horizontal' | 'vertical' | 'auto';
  placementMode?: 'manual' | 'auto';
}

export async function listProjectCharacterOverrides(accessToken: string, projectId: string) {
  return http<CharacterOverrideDto[]>(`/projects/${projectId}/overrides`, {
    method: 'GET',
    accessToken,
  });
}

export async function patchCharacterOverride(
  accessToken: string,
  projectId: string,
  characterId: string,
  patch: Partial<CharacterOverrideDto>
) {
  return http<CharacterOverrideDto>(`/projects/${projectId}/characters/${characterId}/overrides`, {
    method: 'PATCH',
    body: patch,
    accessToken,
  });
}

export async function deleteCharacterOverride(
  accessToken: string,
  projectId: string,
  characterId: string
) {
  return http<{ success: boolean }>(`/projects/${projectId}/characters/${characterId}/overrides`, {
    method: 'DELETE',
    accessToken,
  });
}

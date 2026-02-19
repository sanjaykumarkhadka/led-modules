import { http } from '../lib/http';

export interface ProjectCharacterDto {
  id: string;
  projectId: string;
  blockId: string;
  glyph: string;
  x: number;
  baselineY: number;
  fontSize: number;
  language: string;
  order: number;
}

export async function listProjectCharacters(
  accessToken: string,
  projectId: string,
  blockId?: string
) {
  const query = blockId ? `?blockId=${encodeURIComponent(blockId)}` : '';
  return http<ProjectCharacterDto[]>(`/projects/${projectId}/characters${query}`, {
    method: 'GET',
    accessToken,
  });
}

export async function upsertProjectCharacter(
  accessToken: string,
  projectId: string,
  characterId: string,
  character: Omit<ProjectCharacterDto, 'id' | 'projectId'>
) {
  return http<ProjectCharacterDto>(`/projects/${projectId}/characters/${characterId}`, {
    method: 'PUT',
    body: character,
    accessToken,
  });
}

export async function deleteProjectCharacter(
  accessToken: string,
  projectId: string,
  characterId: string
) {
  return http<{ success: boolean }>(`/projects/${projectId}/characters/${characterId}`, {
    method: 'DELETE',
    accessToken,
  });
}

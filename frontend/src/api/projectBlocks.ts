import { http } from '../lib/http';

export interface ProjectBlockDto {
  id: string;
  projectId: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  language: string;
  order: number;
}

export async function listProjectBlocks(accessToken: string, projectId: string) {
  return http<ProjectBlockDto[]>(`/projects/${projectId}/blocks`, {
    method: 'GET',
    accessToken,
  });
}

export async function upsertProjectBlock(
  accessToken: string,
  projectId: string,
  blockId: string,
  block: Omit<ProjectBlockDto, 'id' | 'projectId'>
) {
  return http<ProjectBlockDto>(`/projects/${projectId}/blocks/${blockId}`, {
    method: 'PUT',
    body: block,
    accessToken,
  });
}

export async function deleteProjectBlock(accessToken: string, projectId: string, blockId: string) {
  return http<{ success: boolean }>(`/projects/${projectId}/blocks/${blockId}`, {
    method: 'DELETE',
    accessToken,
  });
}

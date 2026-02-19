import { http } from '../lib/http';

export interface Project {
  _id: string;
  ownerId: string;
  name: string;
  description?: string;
  isFavorite?: boolean;
  data?: Record<string, unknown>;
  schemaVersion?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPayload {
  name: string;
  description?: string;
  isFavorite?: boolean;
}

export async function listProjects(
  accessToken: string,
): Promise<Project[]> {
  return http<Project[]>('/projects', {
    method: 'GET',
    accessToken,
  });
}

export async function createProject(
  accessToken: string,
  payload: ProjectPayload,
): Promise<Project> {
  return http<Project>('/projects', {
    method: 'POST',
    body: payload,
    accessToken,
  });
}

export async function getProject(
  accessToken: string,
  id: string,
): Promise<Project> {
  return http<Project>(`/projects/${id}`, {
    method: 'GET',
    accessToken,
  });
}

export async function updateProject(
  accessToken: string,
  id: string,
  payload: Partial<ProjectPayload>,
): Promise<Project> {
  return http<Project>(`/projects/${id}`, {
    method: 'PATCH',
    body: payload,
    accessToken,
  });
}

export async function deleteProject(
  accessToken: string,
  id: string,
): Promise<void> {
  await http<unknown>(`/projects/${id}`, {
    method: 'DELETE',
    accessToken,
  });
}

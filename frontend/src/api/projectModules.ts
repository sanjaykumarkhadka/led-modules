import { http } from '../lib/http';
import type { ManualLED } from '../data/store';

export interface CharacterModuleDto {
  id: string;
  projectId: string;
  characterId: string;
  u: number;
  v: number;
  rotation: number;
  scale?: number;
}

export async function listProjectModules(accessToken: string, projectId: string) {
  return http<CharacterModuleDto[]>(`/projects/${projectId}/modules`, {
    method: 'GET',
    accessToken,
  });
}

export async function replaceCharacterModules(
  accessToken: string,
  projectId: string,
  characterId: string,
  modules: ManualLED[]
) {
  return http<CharacterModuleDto[]>(`/projects/${projectId}/characters/${characterId}/modules`, {
    method: 'PUT',
    body: {
      modules: modules.map((m) => ({
        id: m.id,
        u: m.u,
        v: m.v,
        rotation: m.rotation,
        ...(m.scale != null ? { scale: m.scale } : {}),
      })),
    },
    accessToken,
  });
}

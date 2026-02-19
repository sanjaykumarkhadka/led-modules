import { http } from '../lib/http';
import type { CharacterShapeOverride } from '../core/math/shapeWarp';

export interface CharacterShapeOverrideDto {
  projectId: string;
  characterId: string;
  version?: number;
  outerPath?: string;
  holes?: string[];
  units?: 'mm' | 'in';
  bbox?: { x: number; y: number; width: number; height: number };
  sourceType?: 'font_glyph' | 'svg_import' | 'custom_path';
  constraints?: { minStrokeWidthMm?: number; minChannelWidthMm?: number };
  baseBBox?: { x: number; y: number; width: number; height: number };
  mesh?: { rows: number; cols: number; points: Array<{ x: number; y: number }> };
}

export async function listProjectShapeOverrides(accessToken: string, projectId: string) {
  return http<CharacterShapeOverrideDto[]>(`/projects/${projectId}/shapes`, {
    method: 'GET',
    accessToken,
  });
}

export async function putCharacterShapeOverride(
  accessToken: string,
  projectId: string,
  characterId: string,
  shape: CharacterShapeOverride
) {
  return http<CharacterShapeOverrideDto>(`/projects/${projectId}/characters/${characterId}/shape`, {
    method: 'PUT',
    body: shape,
    accessToken,
  });
}

export async function commitCharacterShapeOverride(
  accessToken: string,
  projectId: string,
  characterId: string,
  shape: CharacterShapeOverride,
  modules: Array<{
    id: string;
    u?: number;
    v?: number;
    x?: number;
    y?: number;
    rotation: number;
    scale?: number;
  }>
) {
  return http<{ shape: CharacterShapeOverrideDto; modules: unknown[] }>(
    `/projects/${projectId}/characters/${characterId}/shape-commit`,
    {
      method: 'POST',
      body: { shape, modules },
      accessToken,
    }
  );
}

export async function deleteCharacterShapeOverride(
  accessToken: string,
  projectId: string,
  characterId: string
) {
  return http<{ success: boolean }>(`/projects/${projectId}/characters/${characterId}/shape`, {
    method: 'DELETE',
    accessToken,
  });
}

import 'dotenv/config';
import mongoose, { Connection, Types } from 'mongoose';

type LegacyDesign = {
  blocks?: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    language: string;
  }>;
  charactersByBlock?: Record<
    string,
    Array<{
      id: string;
      glyph: string;
      x: number;
      baselineY: number;
      fontSize: number;
      language: string;
      order: number;
    }>
  >;
  depthInches?: number;
  selectedModuleId?: string;
  showDimensions?: boolean;
  dimensionUnit?: 'mm' | 'in';
  defaultLedCount?: number;
  defaultLedColumns?: number;
  defaultLedOrientation?: 'horizontal' | 'vertical' | 'auto';
  manualLedOverrides?: Record<string, Array<{ id: string; u: number; v: number; rotation: number; scale?: number }>>;
  charShapeOverrides?: Record<
    string,
    {
      version: number;
      baseBBox: { x: number; y: number; width: number; height: number };
      mesh: { rows: number; cols: number; points: Array<{ x: number; y: number }> };
    }
  >;
  ledCountOverrides?: Record<string, number>;
  ledColumnOverrides?: Record<string, number>;
  ledOrientationOverrides?: Record<string, 'horizontal' | 'vertical' | 'auto'>;
  placementModeOverrides?: Record<string, 'manual' | 'auto'>;
};

function ownerAndName(project: any) {
  return `[${String(project.ownerId)}] ${project.name} (${String(project._id)})`;
}

async function migrateProject(conn: Connection, project: any) {
  const design = (project.data ?? {}) as LegacyDesign;
  const projectId = new Types.ObjectId(String(project._id));

  const session = await conn.startSession();
  try {
    await session.withTransaction(async () => {
      await conn.collection('project_design_settings').updateOne(
        { projectId },
        {
          $set: {
            projectId,
            depthInches: design.depthInches ?? 5,
            selectedModuleId: design.selectedModuleId ?? 'tetra-max-medium-24v',
            showDimensions: design.showDimensions ?? true,
            dimensionUnit: design.dimensionUnit ?? 'mm',
            defaultLedCount: design.defaultLedCount ?? 15,
            defaultLedColumns: design.defaultLedColumns ?? 1,
            defaultLedOrientation: design.defaultLedOrientation ?? 'auto',
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true, session },
      );

      const blocks = design.blocks ?? [];
      if (blocks.length > 0) {
        await conn.collection('project_blocks').deleteMany({ projectId }, { session });
        await conn.collection('project_blocks').insertMany(
          blocks.map((b, i) => ({
            id: String(b.id),
            projectId,
            text: b.text ?? '',
            x: b.x,
            y: b.y,
            fontSize: b.fontSize,
            language: b.language ?? 'en',
            order: i,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          { session },
        );
      }

      const byBlock = design.charactersByBlock ?? {};
      const characters = Object.entries(byBlock).flatMap(([blockId, chars]) =>
        (chars ?? []).map((ch, i) => ({
          id: String(ch.id),
          projectId,
          blockId,
          glyph: ch.glyph,
          x: ch.x,
          baselineY: ch.baselineY,
          fontSize: ch.fontSize,
          language: ch.language ?? 'en',
          order: ch.order ?? i,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
      if (characters.length > 0) {
        await conn.collection('project_characters').deleteMany({ projectId }, { session });
        await conn.collection('project_characters').insertMany(characters, { session });
      }

      const modules = Object.entries(design.manualLedOverrides ?? {}).flatMap(([characterId, leds]) =>
        (leds ?? []).map((m) => ({
          id: String(m.id),
          projectId,
          characterId,
          u: m.u,
          v: m.v,
          rotation: m.rotation ?? 0,
          ...(m.scale != null ? { scale: m.scale } : {}),
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
      await conn.collection('character_modules').deleteMany({ projectId }, { session });
      if (modules.length > 0) {
        await conn.collection('character_modules').insertMany(modules, { session });
      }

      const shapes = Object.entries(design.charShapeOverrides ?? {}).map(([characterId, shape]) => ({
        projectId,
        characterId,
        version: shape.version ?? 1,
        baseBBox: shape.baseBBox,
        mesh: shape.mesh,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      await conn.collection('character_shape_overrides').deleteMany({ projectId }, { session });
      if (shapes.length > 0) {
        await conn.collection('character_shape_overrides').insertMany(shapes, { session });
      }

      const overrideIds = new Set<string>([
        ...Object.keys(design.ledCountOverrides ?? {}),
        ...Object.keys(design.ledColumnOverrides ?? {}),
        ...Object.keys(design.ledOrientationOverrides ?? {}),
        ...Object.keys(design.placementModeOverrides ?? {}),
      ]);
      const overrides = Array.from(overrideIds).map((characterId) => ({
        projectId,
        characterId,
        ...(design.ledCountOverrides?.[characterId] != null
          ? { ledCount: design.ledCountOverrides[characterId] }
          : {}),
        ...(design.ledColumnOverrides?.[characterId] != null
          ? { ledColumns: design.ledColumnOverrides[characterId] }
          : {}),
        ...(design.ledOrientationOverrides?.[characterId] != null
          ? { ledOrientation: design.ledOrientationOverrides[characterId] }
          : {}),
        ...(design.placementModeOverrides?.[characterId] != null
          ? { placementMode: design.placementModeOverrides[characterId] }
          : {}),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      await conn.collection('character_overrides').deleteMany({ projectId }, { session });
      if (overrides.length > 0) {
        await conn.collection('character_overrides').insertMany(overrides, { session });
      }

      await conn.collection('projects').updateOne(
        { _id: projectId },
        {
          $set: {
            schemaVersion: 2,
            migratedAt: new Date(),
          },
        },
        { session },
      );
    });
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err };
  } finally {
    await session.endSession();
  }
}

async function main() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/led-modules';
  await mongoose.connect(uri);
  const conn = mongoose.connection;
  const projects = await conn.collection('projects').find({}).toArray();

  const success: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const project of projects) {
    const res = await migrateProject(conn, project);
    if (res.ok) {
      success.push(String(project._id));
      // eslint-disable-next-line no-console
      console.log(`migrated ${ownerAndName(project)}`);
    } else {
      failed.push({ id: String(project._id), error: String(res.error) });
      // eslint-disable-next-line no-console
      console.error(`failed ${ownerAndName(project)}:`, res.error);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        total: projects.length,
        successCount: success.length,
        failCount: failed.length,
        success,
        failed,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

void main();

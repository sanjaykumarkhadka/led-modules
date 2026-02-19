import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { Project } from './schemas/project.schema';
import { ProjectDesignSettings } from './schemas/project-design-settings.schema';
import { ProjectBlock } from './schemas/project-block.schema';
import { ProjectCharacter } from './schemas/project-character.schema';
import { CharacterShapeOverride } from './schemas/character-shape-override.schema';
import { CharacterModule } from './schemas/character-module.schema';
import { CharacterOverride } from './schemas/character-override.schema';

interface ProjectMetaPayload {
  name: string;
  description?: string;
  isFavorite?: boolean;
}

interface ProjectDesignSettingsPatch {
  depthInches?: number;
  selectedModuleId?: string;
  showDimensions?: boolean;
  dimensionUnit?: 'mm' | 'in';
  defaultLedCount?: number;
  defaultLedColumns?: number;
  defaultLedOrientation?: 'horizontal' | 'vertical' | 'auto';
}

@Injectable()
export class ProjectsService {
  private transactionsSupported: boolean | null = null;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Project.name) private readonly projectModel: Model<Project>,
    @InjectModel(ProjectDesignSettings.name)
    private readonly designSettingsModel: Model<ProjectDesignSettings>,
    @InjectModel(ProjectBlock.name) private readonly blockModel: Model<ProjectBlock>,
    @InjectModel(ProjectCharacter.name) private readonly characterModel: Model<ProjectCharacter>,
    @InjectModel(CharacterShapeOverride.name)
    private readonly shapeOverrideModel: Model<CharacterShapeOverride>,
    @InjectModel(CharacterModule.name) private readonly moduleModel: Model<CharacterModule>,
    @InjectModel(CharacterOverride.name)
    private readonly characterOverrideModel: Model<CharacterOverride>,
  ) {}

  private ownerId(userId: string) {
    return new Types.ObjectId(userId);
  }

  private isTransactionUnsupportedError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const withCode = error as { code?: unknown; codeName?: unknown; message?: unknown };
    return (
      withCode.code === 20 ||
      withCode.codeName === 'IllegalOperation' ||
      (typeof withCode.message === 'string' &&
        withCode.message.includes('Transaction numbers are only allowed'))
    );
  }

  private async detectTransactionsSupport(): Promise<boolean> {
    if (this.transactionsSupported != null) {
      return this.transactionsSupported;
    }
    try {
      const db = this.connection.db;
      if (!db) {
        this.transactionsSupported = false;
        return this.transactionsSupported;
      }
      const hello = await db.admin().command({ hello: 1 });
      this.transactionsSupported = Boolean(
        hello?.setName || hello?.isWritablePrimary || hello?.msg === 'isdbgrid',
      );
    } catch {
      this.transactionsSupported = false;
    }
    return this.transactionsSupported;
  }

  private async withOptionalTransaction<T>(
    operation: (session?: ClientSession) => Promise<T>,
  ): Promise<T> {
    if (!(await this.detectTransactionsSupport())) {
      return operation();
    }

    const session = await this.connection.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result;
    } catch (error) {
      if (this.isTransactionUnsupportedError(error)) {
        this.transactionsSupported = false;
        return operation();
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private async assertProjectOwned(userId: string, projectId: string) {
    const project = await this.projectModel
      .findOne({ _id: projectId, ownerId: this.ownerId(userId) })
      .exec();
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async listForUser(userId: string) {
    return this.projectModel
      .find({ ownerId: this.ownerId(userId) })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async createForUser(userId: string, payload: ProjectMetaPayload) {
    return this.withOptionalTransaction(async (session) => {
      const projectDoc = {
        ownerId: this.ownerId(userId),
        name: payload.name,
        description: payload.description,
        isFavorite: payload.isFavorite ?? false,
        schemaVersion: 2,
      };
      const [project] = session
        ? await this.projectModel.create([projectDoc], { session })
        : await this.projectModel.create([projectDoc]);

      const settingsDoc = {
        projectId: project._id,
        depthInches: 5,
        selectedModuleId: 'tetra-max-medium-24v',
        showDimensions: true,
        dimensionUnit: 'mm' as const,
        defaultLedCount: 15,
        defaultLedColumns: 1,
        defaultLedOrientation: 'auto' as const,
      };
      if (session) {
        await this.designSettingsModel.create([settingsDoc], { session });
      } else {
        await this.designSettingsModel.create([settingsDoc]);
      }
      return project;
    });
  }

  async getForUser(userId: string, id: string) {
    return this.assertProjectOwned(userId, id);
  }

  async updateForUser(userId: string, id: string, payload: Partial<ProjectMetaPayload>) {
    const updated = await this.projectModel
      .findOneAndUpdate(
        { _id: id, ownerId: this.ownerId(userId) },
        { $set: payload },
        { returnDocument: 'after' },
      )
      .exec();
    if (!updated) throw new NotFoundException('Project not found');
    return updated;
  }

  async deleteForUser(userId: string, id: string) {
    const project = await this.assertProjectOwned(userId, id);
    await this.withOptionalTransaction(async (session) => {
      const projectId = project._id as Types.ObjectId;
      const queries = [
        this.designSettingsModel.deleteOne({ projectId }),
        this.blockModel.deleteMany({ projectId }),
        this.characterModel.deleteMany({ projectId }),
        this.shapeOverrideModel.deleteMany({ projectId }),
        this.moduleModel.deleteMany({ projectId }),
        this.characterOverrideModel.deleteMany({ projectId }),
        this.projectModel.deleteOne({ _id: projectId, ownerId: this.ownerId(userId) }),
      ];
      for (const query of queries) {
        if (session) query.session(session);
        await query.exec();
      }
    });
  }

  async getDesignSettings(userId: string, projectId: string) {
    const project = await this.assertProjectOwned(userId, projectId);
    const settings = await this.designSettingsModel.findOne({ projectId: project._id }).exec();
    return settings;
  }

  async patchDesignSettings(
    userId: string,
    projectId: string,
    patch: ProjectDesignSettingsPatch,
  ) {
    const project = await this.assertProjectOwned(userId, projectId);
    const updated = await this.designSettingsModel
      .findOneAndUpdate(
        { projectId: project._id },
        { $set: patch },
        { returnDocument: 'after', upsert: true },
      )
      .exec();
    return updated;
  }

  async listBlocks(userId: string, projectId: string) {
    const project = await this.assertProjectOwned(userId, projectId);
    return this.blockModel.find({ projectId: project._id }).sort({ order: 1 }).exec();
  }

  async upsertBlock(
    userId: string,
    projectId: string,
    block: {
      id: string;
      text: string;
      x: number;
      y: number;
      fontSize: number;
      language: string;
      order: number;
    },
  ) {
    const project = await this.assertProjectOwned(userId, projectId);
    return this.blockModel
      .findOneAndUpdate(
        { id: block.id, projectId: project._id },
        {
          $set: {
            text: block.text,
            x: block.x,
            y: block.y,
            fontSize: block.fontSize,
            language: block.language,
            order: block.order,
          },
          $setOnInsert: { id: block.id, projectId: project._id },
        },
        { returnDocument: 'after', upsert: true },
      )
      .exec();
  }

  async deleteBlock(userId: string, projectId: string, blockId: string) {
    const project = await this.assertProjectOwned(userId, projectId);
    await this.withOptionalTransaction(async (session) => {
      const charsQuery = this.characterModel.find({ projectId: project._id, blockId }).select({ id: 1 }).lean();
      if (session) charsQuery.session(session);
      const charsResult = await charsQuery.exec();
      const charIds = charsResult.map((ch) => ch.id as string);
      if (charIds.length > 0) {
        const cleanupQueries = [
          this.moduleModel.deleteMany({ projectId: project._id, characterId: { $in: charIds } }),
          this.shapeOverrideModel.deleteMany({ projectId: project._id, characterId: { $in: charIds } }),
          this.characterOverrideModel.deleteMany({ projectId: project._id, characterId: { $in: charIds } }),
        ];
        for (const query of cleanupQueries) {
          if (session) query.session(session);
          await query.exec();
        }
      }
      const deleteCharsQuery = this.characterModel.deleteMany({ projectId: project._id, blockId });
      if (session) deleteCharsQuery.session(session);
      await deleteCharsQuery.exec();

      const deleteBlockQuery = this.blockModel.deleteOne({ id: blockId, projectId: project._id });
      if (session) deleteBlockQuery.session(session);
      await deleteBlockQuery.exec();
    });
  }

  async listCharacters(userId: string, projectId: string, blockId?: string) {
    const project = await this.assertProjectOwned(userId, projectId);
    const filter: Record<string, unknown> = { projectId: project._id };
    if (blockId) filter.blockId = blockId;
    return this.characterModel.find(filter).sort({ order: 1 }).exec();
  }

  async upsertCharacter(
    userId: string,
    projectId: string,
    char: {
      id: string;
      blockId: string;
      glyph: string;
      x: number;
      baselineY: number;
      fontSize: number;
      language: string;
      order: number;
    },
  ) {
    const project = await this.assertProjectOwned(userId, projectId);
    return this.characterModel
      .findOneAndUpdate(
        { id: char.id, projectId: project._id },
        {
          $set: {
            blockId: char.blockId,
            glyph: char.glyph,
            x: char.x,
            baselineY: char.baselineY,
            fontSize: char.fontSize,
            language: char.language,
            order: char.order,
          },
          $setOnInsert: { id: char.id, projectId: project._id },
        },
        { returnDocument: 'after', upsert: true },
      )
      .exec();
  }

  async deleteCharacter(userId: string, projectId: string, characterId: string) {
    const project = await this.assertProjectOwned(userId, projectId);
    await this.withOptionalTransaction(async (session) => {
      const queries = [
        this.moduleModel.deleteMany({ projectId: project._id, characterId }),
        this.shapeOverrideModel.deleteMany({ projectId: project._id, characterId }),
        this.characterOverrideModel.deleteMany({ projectId: project._id, characterId }),
        this.characterModel.deleteOne({ id: characterId, projectId: project._id }),
      ];
      for (const query of queries) {
        if (session) query.session(session);
        await query.exec();
      }
    });
  }

  async listAllShapeOverrides(userId: string, projectId: string) {
    const project = await this.assertProjectOwned(userId, projectId);
    return this.shapeOverrideModel.find({ projectId: project._id }).exec();
  }

  async getShapeOverride(userId: string, projectId: string, characterId: string) {
    const project = await this.assertProjectOwned(userId, projectId);
    return this.shapeOverrideModel.findOne({ projectId: project._id, characterId }).exec();
  }

  async putShapeOverride(
    userId: string,
    projectId: string,
    characterId: string,
    payload: {
      version: number;
      baseBBox: { x: number; y: number; width: number; height: number };
      mesh: { rows: number; cols: number; points: Array<{ x: number; y: number }> };
    },
  ) {
    const project = await this.assertProjectOwned(userId, projectId);
    return this.shapeOverrideModel
      .findOneAndUpdate(
        { projectId: project._id, characterId },
        {
          $set: {
            version: payload.version,
            baseBBox: payload.baseBBox,
            mesh: payload.mesh,
          },
        },
        { returnDocument: 'after', upsert: true },
      )
      .exec();
  }

  async deleteShapeOverride(userId: string, projectId: string, characterId: string) {
    const project = await this.assertProjectOwned(userId, projectId);
    await this.shapeOverrideModel.deleteOne({ projectId: project._id, characterId }).exec();
  }

  async listAllModules(userId: string, projectId: string) {
    const project = await this.assertProjectOwned(userId, projectId);
    return this.moduleModel.find({ projectId: project._id }).exec();
  }

  async listModules(userId: string, projectId: string, characterId: string) {
    const project = await this.assertProjectOwned(userId, projectId);
    return this.moduleModel.find({ projectId: project._id, characterId }).exec();
  }

  async replaceModules(
    userId: string,
    projectId: string,
    characterId: string,
    modules: Array<{ id: string; u: number; v: number; rotation: number; scale?: number }>,
  ) {
    const project = await this.assertProjectOwned(userId, projectId);
    await this.withOptionalTransaction(async (session) => {
      const deleteQuery = this.moduleModel.deleteMany({ projectId: project._id, characterId });
      if (session) {
        deleteQuery.session(session);
      }
      await deleteQuery.exec();
      if (modules.length > 0) {
        const docs = modules.map((m) => ({
          id: m.id,
          projectId: project._id,
          characterId,
          u: m.u,
          v: m.v,
          rotation: m.rotation,
          ...(m.scale != null ? { scale: m.scale } : {}),
        }));
        if (session) {
          await this.moduleModel.insertMany(docs, { session });
        } else {
          await this.moduleModel.insertMany(docs);
        }
      }
    });
    return this.listModules(userId, projectId, characterId);
  }

  async listAllCharacterOverrides(userId: string, projectId: string) {
    const project = await this.assertProjectOwned(userId, projectId);
    return this.characterOverrideModel.find({ projectId: project._id }).exec();
  }

  async getCharacterOverride(userId: string, projectId: string, characterId: string) {
    const project = await this.assertProjectOwned(userId, projectId);
    return this.characterOverrideModel.findOne({ projectId: project._id, characterId }).exec();
  }

  async patchCharacterOverride(
    userId: string,
    projectId: string,
    characterId: string,
    patch: {
      ledCount?: number;
      ledColumns?: number;
      ledOrientation?: 'horizontal' | 'vertical' | 'auto';
      placementMode?: 'manual' | 'auto';
    },
  ) {
    const project = await this.assertProjectOwned(userId, projectId);
    return this.characterOverrideModel
      .findOneAndUpdate(
        { projectId: project._id, characterId },
        { $set: patch },
        { returnDocument: 'after', upsert: true },
      )
      .exec();
  }

  async deleteCharacterOverride(userId: string, projectId: string, characterId: string) {
    const project = await this.assertProjectOwned(userId, projectId);
    await this.characterOverrideModel.deleteOne({ projectId: project._id, characterId }).exec();
  }
}

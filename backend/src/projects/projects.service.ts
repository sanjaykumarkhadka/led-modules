import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project } from './schemas/project.schema';

interface UpsertProjectPayload {
  name: string;
  description?: string;
  data: Record<string, unknown>;
  isFavorite?: boolean;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name)
    private readonly projectModel: Model<Project>,
  ) {}

  async listForUser(userId: string): Promise<Project[]> {
    return this.projectModel
      .find({ ownerId: new Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async createForUser(
    userId: string,
    payload: UpsertProjectPayload,
  ): Promise<Project> {
    const created = new this.projectModel({
      ownerId: new Types.ObjectId(userId),
      ...payload,
    });
    return created.save();
  }

  async getForUser(userId: string, id: string): Promise<Project> {
    const project = await this.projectModel
      .findOne({ _id: id, ownerId: new Types.ObjectId(userId) })
      .exec();
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async updateForUser(
    userId: string,
    id: string,
    payload: UpsertProjectPayload,
  ): Promise<Project> {
    const updated = await this.projectModel
      .findOneAndUpdate(
        { _id: id, ownerId: new Types.ObjectId(userId) },
        { $set: payload },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('Project not found');
    }
    return updated;
  }

  async deleteForUser(userId: string, id: string): Promise<void> {
    const res = await this.projectModel
      .deleteOne({ _id: id, ownerId: new Types.ObjectId(userId) })
      .exec();
    if (!res.deletedCount) {
      throw new NotFoundException('Project not found');
    }
  }
}

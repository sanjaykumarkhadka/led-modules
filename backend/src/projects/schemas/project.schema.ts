import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Project extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: Boolean, default: false })
  isFavorite: boolean;

  // Legacy design blob kept for migration compatibility only.
  @Prop({ type: Object, required: false })
  data: Record<string, unknown>;

  @Prop({ type: Number, default: 2 })
  schemaVersion: number;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ ownerId: 1, updatedAt: -1 });
ProjectSchema.index({ ownerId: 1, isFavorite: 1, updatedAt: -1 });
ProjectSchema.index({ ownerId: 1, name: 1 });

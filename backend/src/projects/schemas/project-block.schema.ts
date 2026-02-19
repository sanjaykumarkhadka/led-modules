import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'project_blocks' })
export class ProjectBlock extends Document {
  @Prop({ type: String, required: true })
  id: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ type: String, required: true, default: '' })
  text: string;

  @Prop({ type: Number, required: true })
  x: number;

  @Prop({ type: Number, required: true })
  y: number;

  @Prop({ type: Number, required: true })
  fontSize: number;

  @Prop({ type: String, required: true, default: 'en' })
  language: string;

  @Prop({ type: Number, required: true, default: 0 })
  order: number;
}

export const ProjectBlockSchema: any = SchemaFactory.createForClass(ProjectBlock);
ProjectBlockSchema.index({ projectId: 1, order: 1 });
ProjectBlockSchema.index({ projectId: 1, id: 1 }, { unique: true });

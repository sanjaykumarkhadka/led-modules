import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'project_characters' })
export class ProjectCharacter extends Document {
  @Prop({ type: String, required: true })
  id: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ type: String, ref: 'ProjectBlock', required: true, index: true })
  blockId: string;

  @Prop({ type: String, required: true })
  glyph: string;

  @Prop({ type: Number, required: true })
  x: number;

  @Prop({ type: Number, required: true })
  baselineY: number;

  @Prop({ type: Number, required: true })
  fontSize: number;

  @Prop({ type: String, required: true, default: 'en' })
  language: string;

  @Prop({ type: Number, required: true, default: 0 })
  order: number;
}

export const ProjectCharacterSchema: any = SchemaFactory.createForClass(ProjectCharacter);
ProjectCharacterSchema.index({ projectId: 1, blockId: 1, order: 1 });
ProjectCharacterSchema.index({ projectId: 1, id: 1 }, { unique: true });

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

  // Serialized LED design data; keep flexible for now
  @Prop({ type: Object, required: true })
  data: Record<string, unknown>;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);


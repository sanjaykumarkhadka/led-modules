import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'project_design_settings' })
export class ProjectDesignSettings extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, unique: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ type: Number, required: true, default: 5 })
  depthInches: number;

  @Prop({ type: String, required: true, default: 'tetra-max-medium-24v' })
  selectedModuleId: string;

  @Prop({ type: Boolean, required: true, default: true })
  showDimensions: boolean;

  @Prop({ type: String, enum: ['mm', 'in'], required: true, default: 'mm' })
  dimensionUnit: 'mm' | 'in';

  @Prop({ type: Number, required: true, default: 15 })
  defaultLedCount: number;

  @Prop({ type: Number, required: true, default: 1 })
  defaultLedColumns: number;

  @Prop({
    type: String,
    enum: ['horizontal', 'vertical', 'auto'],
    required: true,
    default: 'auto',
  })
  defaultLedOrientation: 'horizontal' | 'vertical' | 'auto';
}

export const ProjectDesignSettingsSchema = SchemaFactory.createForClass(ProjectDesignSettings);

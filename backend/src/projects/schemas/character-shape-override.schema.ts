import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

class ShapePoint {
  @Prop({ type: Number, required: true })
  x: number;

  @Prop({ type: Number, required: true })
  y: number;
}

class BaseBBox {
  @Prop({ type: Number, required: true })
  x: number;

  @Prop({ type: Number, required: true })
  y: number;

  @Prop({ type: Number, required: true })
  width: number;

  @Prop({ type: Number, required: true })
  height: number;
}

class ShapeMesh {
  @Prop({ type: Number, required: true, min: 2, max: 8 })
  rows: number;

  @Prop({ type: Number, required: true, min: 2, max: 8 })
  cols: number;

  @Prop({ type: [ShapePoint], required: true, default: [] })
  points: ShapePoint[];
}

class ShapeConstraint {
  @Prop({ type: Number })
  minStrokeWidthMm?: number;

  @Prop({ type: Number })
  minChannelWidthMm?: number;
}

@Schema({ timestamps: true, collection: 'character_shape_overrides' })
export class CharacterShapeOverride extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ type: String, ref: 'ProjectCharacter', required: true, unique: true })
  characterId: string;

  @Prop({ type: Number, required: true, default: 2 })
  version: number;

  // v2 canonical path-native geometry
  @Prop({ type: String })
  outerPath?: string;

  @Prop({ type: [String], default: [] })
  holes?: string[];

  @Prop({ type: String, enum: ['mm', 'in'], default: 'mm' })
  units?: 'mm' | 'in';

  @Prop({ type: BaseBBox })
  bbox?: BaseBBox;

  @Prop({ type: String, enum: ['font_glyph', 'svg_import', 'custom_path'], default: 'font_glyph' })
  sourceType?: 'font_glyph' | 'svg_import' | 'custom_path';

  @Prop({ type: ShapeConstraint })
  constraints?: ShapeConstraint;

  // Legacy mesh fields kept for compatibility reads.
  @Prop({ type: BaseBBox })
  baseBBox?: BaseBBox;

  @Prop({ type: ShapeMesh })
  mesh?: ShapeMesh;
}

export const CharacterShapeOverrideSchema = SchemaFactory.createForClass(CharacterShapeOverride);
CharacterShapeOverrideSchema.index({ projectId: 1, characterId: 1 });

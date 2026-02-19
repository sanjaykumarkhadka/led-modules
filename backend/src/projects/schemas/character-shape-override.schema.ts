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

@Schema({ timestamps: true, collection: 'character_shape_overrides' })
export class CharacterShapeOverride extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ type: String, ref: 'ProjectCharacter', required: true, unique: true })
  characterId: string;

  @Prop({ type: Number, required: true, default: 1 })
  version: number;

  @Prop({ type: BaseBBox, required: true })
  baseBBox: BaseBBox;

  @Prop({ type: ShapeMesh, required: true })
  mesh: ShapeMesh;
}

export const CharacterShapeOverrideSchema = SchemaFactory.createForClass(CharacterShapeOverride);
CharacterShapeOverrideSchema.index({ projectId: 1, characterId: 1 });

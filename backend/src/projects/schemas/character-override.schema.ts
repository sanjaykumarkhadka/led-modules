import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'character_overrides' })
export class CharacterOverride extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ type: String, ref: 'ProjectCharacter', required: true, unique: true })
  characterId: string;

  @Prop({ type: Number })
  ledCount?: number;

  @Prop({ type: Number })
  ledColumns?: number;

  @Prop({ type: String, enum: ['horizontal', 'vertical', 'auto'] })
  ledOrientation?: 'horizontal' | 'vertical' | 'auto';

  @Prop({ type: String, enum: ['manual', 'auto'] })
  placementMode?: 'manual' | 'auto';
}

export const CharacterOverrideSchema = SchemaFactory.createForClass(CharacterOverride);
CharacterOverrideSchema.index({ projectId: 1, characterId: 1 });

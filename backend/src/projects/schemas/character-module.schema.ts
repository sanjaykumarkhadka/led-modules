import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'character_modules' })
export class CharacterModule extends Document {
  @Prop({ type: String, required: true })
  id: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ type: String, ref: 'ProjectCharacter', required: true, index: true })
  characterId: string;

  @Prop({ type: Number, required: true })
  u: number;

  @Prop({ type: Number, required: true })
  v: number;

  @Prop({ type: Number, required: true, default: 0 })
  rotation: number;

  @Prop({ type: Number })
  scale?: number;
}

export const CharacterModuleSchema: any = SchemaFactory.createForClass(CharacterModule);
CharacterModuleSchema.index({ projectId: 1, characterId: 1 });
CharacterModuleSchema.index({ projectId: 1, characterId: 1, id: 1 }, { unique: true });

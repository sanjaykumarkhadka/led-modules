import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop()
  displayName?: string;

  @Prop({ default: 'user' })
  role: 'user' | 'admin';

  @Prop({ type: String, nullable: true })
  hashedRefreshToken?: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);


import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  async createUser(params: {
    email: string;
    passwordHash: string;
    displayName?: string;
  }): Promise<User> {
    const created = new this.userModel({
      email: params.email.toLowerCase().trim(),
      passwordHash: params.passwordHash,
      displayName: params.displayName,
    });
    return created.save();
  }
}

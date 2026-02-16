import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { Tokens } from './auth.types';
import { User } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async hash(data: string): Promise<string> {
    const saltOrRounds = 10;
    return bcrypt.hash(data, saltOrRounds);
  }

  private async verifyHash(data: string, hash: string): Promise<boolean> {
    return bcrypt.compare(data, hash);
  }

  private async signTokens(user: User): Promise<Tokens> {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessOptions: JwtSignOptions = {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET') as string,
      expiresIn: (this.configService.get<string>(
        'JWT_ACCESS_EXPIRES_IN',
      ) || '15m') as any,
    };

    const refreshOptions: JwtSignOptions = {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET') as string,
      expiresIn: (this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
      ) || '7d') as any,
    };

    const accessToken = await this.jwtService.signAsync(payload, accessOptions);
    const refreshToken = await this.jwtService.signAsync(
      payload,
      refreshOptions,
    );

    return { accessToken, refreshToken };
  }

  async signup(dto: SignupDto): Promise<{ user: any; tokens: Tokens }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new UnauthorizedException('Email already in use');
    }

    const passwordHash = await this.hash(dto.password);
    const user = await this.usersService.createUser({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
    });

    const tokens = await this.signTokens(user);
    return {
      user: this.toSafeUser(user),
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<{ user: any; tokens: Tokens }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await this.verifyHash(
      dto.password,
      user.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.signTokens(user);
    return {
      user: this.toSafeUser(user),
      tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<Tokens> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role?: string;
      }>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException();
      }

      return this.signTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private toSafeUser(user: User) {
    return {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: (user as any).createdAt,
      updatedAt: (user as any).updatedAt,
    };
  }
}

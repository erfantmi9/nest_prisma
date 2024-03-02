import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthDto } from './dto';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: AuthDto) {
    //find user
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });
    //if user not found, throw error
    if (!user) {
      throw new ForbiddenException('Invalid credentials');
    }

    //compare password
    const valid = await argon2.verify(user.password, dto.password);

    //if password is wrong, throw error
    if (!valid) {
      throw new ForbiddenException('Invalid credentials');
    }
    //send back user
    return this.signToken(user.id, user.email);
  }

  async register(dto: AuthDto) {
    //generate hash
    const hash = await argon2.hash(dto.password);

    //save user
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hash,
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          name: true,
        },
      });

      //return user
      return this.signToken(user.id, user.email);
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ForbiddenException('Email already exists');
      }
      throw error;
    }
  }

  /**
   * Generates a JWT token with the provided user ID and email.
   * @param userId - The ID of the user.
   * @param email - The email of the user.
   * @returns An object containing the access token.
   */
  async signToken(
    userId: string,
    email: string,
  ): Promise<{ access_token: string }> {
    const payload = { sub: userId, email: email };
    const secret = this.config.get('JWT_SECRET');
    const token = this.jwt.sign(payload, {
      expiresIn: '15m',
      secret: secret,
    });

    return {
      access_token: token,
    };
  }
}

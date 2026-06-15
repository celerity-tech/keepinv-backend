import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';

import { PrismaConnection } from '../../core/database/prisma-connection';
import { PG_BYPASS_SETTING } from '../../core/tenant/tenant.types';
import { LoginDTO } from './dto/login.dto';
import type { AuthResult, JwtPayload, LoginUser } from './types/auth.types';

// Pre-computed bcrypt hash of a random string. Used to keep timing constant
// when the user lookup misses, so attackers can't enumerate accounts.
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.D6Z/3p1zVcr7e9LpO5z9C5jM1qWG';

// Singleton (passport strategies depend on it and must be singletons). Uses the singleton
// connection directly with an explicit RLS bypass — login is global-by-email and happens
// before any tenant is known. It deliberately does NOT use the request-scoped PrismaService.
@Injectable()
export class AuthService {
  constructor(
    private readonly connection: PrismaConnection,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(loginDto: LoginDTO): Promise<LoginUser> {
    const email = loginDto.email.trim().toLowerCase();

    const user = await this.connection.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config(${PG_BYPASS_SETTING}, 'on', true)`;
      return tx.user.findUnique({ where: { email } });
    });

    const isValid = await bcrypt.compare(loginDto.password, user?.password ?? DUMMY_HASH);
    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { password, ...safeUser } = user;
    return safeUser;
  }

  async login(user: LoginUser): Promise<AuthResult> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
      accessToken,
    };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';

import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { TENANT_CLS_KEY, TenantContext } from '../../core/tenant/tenant.types';
import { LoginDTO } from './dto/login.dto';
import type { AuthResult, JwtPayload, LoginUser } from './types/auth.types';

// Pre-computed bcrypt hash of a random string. Used to keep timing constant
// when the user lookup misses, so attackers can't enumerate accounts.
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.D6Z/3p1zVcr7e9LpO5z9C5jM1qWG';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly cls: ClsService,
  ) {}

  async validateUser(loginDto: LoginDTO): Promise<LoginUser> {
    // Login happens before any tenant is known, and email is globally unique, so the
    // lookup must escape RLS. Bypass is scoped to this single (read-only) request.
    if (this.cls.isActive()) {
      this.cls.set<TenantContext>(TENANT_CLS_KEY, { systemBypass: true });
    }

    const user = await this.usersService.findUserByEmail(loginDto.email);
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

import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../core/database/prisma.service';
import { CreateUserDTO } from './dto/create-user.dto';
import type { SafeUser } from './types/users.types';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // organization_id is omitted: the DB column DEFAULT (current_setting('app.current_org_id'))
  // scopes the new user to the caller's organization. Email is globally unique, so a clash in
  // another tenant is invisible under RLS and surfaces as a unique-constraint violation here.
  async createUser(createUserDTO: CreateUserDTO): Promise<SafeUser> {
    const email = this.normalizeEmail(createUserDTO.email);

    try {
      return await this.prisma.user.create({
        data: {
          ...createUserDTO,
          email,
          password: await bcrypt.hash(createUserDTO.password, 10),
        },
        omit: { password: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  async getAllUsers() {
    return this.prisma.user.findMany({ omit: { password: true } });
  }

  async findUserById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      omit: { password: true },
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}

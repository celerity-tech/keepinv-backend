import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaConnection } from '../../core/database/prisma-connection';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let connection: { $transaction: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    connection = { $transaction: jest.fn() };
    jwtService = { signAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaConnection, useValue: connection },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

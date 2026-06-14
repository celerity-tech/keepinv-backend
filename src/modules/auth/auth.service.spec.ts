import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findUserByEmail: jest.Mock };
  let jwtService: { signAsync: jest.Mock };
  let cls: { isActive: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    usersService = { findUserByEmail: jest.fn() };
    jwtService = { signAsync: jest.fn() };
    cls = { isActive: jest.fn().mockReturnValue(false), set: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ClsService, useValue: cls },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

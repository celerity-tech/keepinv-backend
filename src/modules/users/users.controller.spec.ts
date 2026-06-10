import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

type UsersServiceMock = Record<
  'createUser' | 'getAllUsers' | 'findUserByEmail' | 'findUserById',
  jest.Mock
>;

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersServiceMock;

  beforeEach(async () => {
    service = {
      createUser: jest.fn(),
      getAllUsers: jest.fn(),
      findUserByEmail: jest.fn(),
      findUserById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing'
import type { Request } from 'express'
import { AuthController } from './auth.controller'
import { AuthResponse, AuthService, LoginDto, RefreshTokenDto, RegisterDto } from './services/auth.service'

describe('AuthController', () => {
  let controller: AuthController

  const authServiceMock = {
    register: jest.fn<Promise<AuthResponse>, [RegisterDto, string | undefined]>(),
    login: jest.fn<Promise<AuthResponse>, [LoginDto, string | undefined]>(),
    refreshToken: jest.fn<Promise<AuthResponse>, [RefreshTokenDto, string | undefined]>(),
    logout: jest.fn<Promise<void>, [string]>(),
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compile()

    controller = module.get<AuthController>(AuthController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('register delegates to auth service with request IP', async () => {
    const dto: RegisterDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      organizationName: 'Test Org',
      organizationSlug: 'test-org',
    }
    const response: AuthResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        email: dto.email,
        name: dto.name,
        role: 'OWNER',
        organizationId: 'org-1',
      },
    }

    authServiceMock.register.mockResolvedValue(response)

    const req = {
      ip: '127.0.0.1',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as Request

    await expect(controller.register(dto, req)).resolves.toEqual(response)
    expect(authServiceMock.register).toHaveBeenCalledWith(dto, '127.0.0.1')
  })

  it('login delegates to auth service with request IP', async () => {
    const dto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    }
    const response: AuthResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        email: dto.email,
        name: 'Test User',
        role: 'OWNER',
        organizationId: 'org-1',
      },
    }

    authServiceMock.login.mockResolvedValue(response)

    const req = {
      ip: undefined,
      headers: { 'x-forwarded-for': '10.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request

    await expect(controller.login(dto, req)).resolves.toEqual(response)
    expect(authServiceMock.login).toHaveBeenCalledWith(dto, '10.0.0.1')
  })

  it('refresh delegates to auth service with request IP', async () => {
    const dto: RefreshTokenDto = {
      refreshToken: 'refresh-token',
    }
    const response: AuthResponse = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'OWNER',
        organizationId: 'org-1',
      },
    }

    authServiceMock.refreshToken.mockResolvedValue(response)

    const req = {
      ip: undefined,
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request

    await expect(controller.refresh(dto, req)).resolves.toEqual(response)
    expect(authServiceMock.refreshToken).toHaveBeenCalledWith(dto, '127.0.0.1')
  })
})

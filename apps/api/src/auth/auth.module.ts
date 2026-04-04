import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { AuthService } from './services/auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './strategies/jwt.strategy'
import { JwtService } from './services/jwt.service'
import { CryptoService } from './services/crypto.service'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    ConfigModule,
    EventEmitterModule,
  ],
  providers: [AuthService, JwtStrategy, JwtService, CryptoService],
  controllers: [AuthController],
  exports: [JwtService, CryptoService],
})
export class AuthModule {}

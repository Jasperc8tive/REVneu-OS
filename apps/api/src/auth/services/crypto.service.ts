import { Injectable } from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'
import * as bcrypt from 'bcrypt'

@Injectable()
export class CryptoService {
  private readonly SALT_ROUNDS = 12

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS)
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  generateToken(length: number = 32): string {
    return randomBytes(length).toString('hex')
  }
}

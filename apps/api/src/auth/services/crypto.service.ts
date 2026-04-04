import { Injectable } from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'

@Injectable()
export class CryptoService {
  hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex')
  }

  verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  generateToken(length: number = 32): string {
    return randomBytes(length).toString('hex')
  }
}

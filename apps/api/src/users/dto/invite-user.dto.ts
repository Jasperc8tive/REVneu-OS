import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

export class InviteUserDto {
  @IsEmail()
  email!: string

  @IsIn(['ADMIN', 'ANALYST', 'VIEWER'])
  role!: 'ADMIN' | 'ANALYST' | 'VIEWER'

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string
}

import { IsString, Matches, MinLength } from 'class-validator';

const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;

export class LoginDto {
  @Matches(USERNAME, { message: 'username must be 3-20 characters: letters, numbers, underscore only.' })
  username: string;

  @IsString()
  @MinLength(1)
  password: string;
}

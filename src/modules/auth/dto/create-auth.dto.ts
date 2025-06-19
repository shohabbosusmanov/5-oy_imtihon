import {
  IsEmail,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  Length,
} from 'class-validator';

export class CreateAuthDto {
  @IsString()
  @Length(5, 50)
  @IsNotEmpty()
  username: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsPhoneNumber('UZ')
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @Length(5, 50)
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @Length(5, 50)
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  session_token: string;
}

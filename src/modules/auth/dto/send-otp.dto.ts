import { IsNotEmpty, IsPhoneNumber } from 'class-validator';

export class SendOtpDto {
  @IsPhoneNumber('UZ')
  @IsNotEmpty()
  phoneNumber: string;
}

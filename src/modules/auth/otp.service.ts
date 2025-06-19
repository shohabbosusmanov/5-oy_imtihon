import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisServcie } from 'src/core/database/redis.service';
import { generate } from 'otp-generator';
import { SmsService } from './sms.service';
import OtpSecurityService from './otp.security.service';

@Injectable()
export class OtpService {
  constructor(
    private redisService: RedisServcie,
    private smsService: SmsService,
    private otpSecurityService: OtpSecurityService,
  ) {}

  generateOtp() {
    const otp = generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      specialChars: false,
      upperCaseAlphabets: false,
    });
    return otp;
  }

  private getSessionToken() {
    const token = crypto.randomUUID();

    return token;
  }

  async sendOtp(phone_number: string) {
    await this.otpSecurityService.checkIfTemporaryBlockedUser(phone_number);
    await this.checkExistedOtp(`user:${phone_number}`);
    const tempOtp = this.generateOtp();
    const responseRedis = await this.redisService.setOtp(phone_number, tempOtp);

    if (responseRedis == 'OK') {
      await this.smsService.sendSms(phone_number, tempOtp);
      return true;
    }
  }

  async checkExistedOtp(key: string) {
    const check = await this.redisService.getOtp(key);
    if (check) {
      const ttl = await this.redisService.getTtlKey(key);
      throw new BadRequestException(`Please try againn after ${ttl} second`);
    }
  }

  async verifyOtpSendedUser(key: string, code: string, phone_number: string) {
    await this.otpSecurityService.checkIfTemporaryBlockedUser(phone_number);
    const otp = await this.redisService.getOtp(key);
    if (!otp) {
      throw new BadRequestException('invalid code');
    }
    if (otp !== code) {
      const attempts =
        await this.otpSecurityService.recordFailedOtpAttempts(phone_number);
      throw new BadRequestException({
        message: 'invalid code',
        attempts: `You have ${attempts} attempts`,
      });
    }
    await this.redisService.delKey(key);
    await this.otpSecurityService.delOtpAttempts(
      `otp_attempts:${phone_number}`,
    );
    const sessionToken = this.getSessionToken();

    await this.redisService.setSessionTokenUser(phone_number, sessionToken);
    return sessionToken;
  }

  async checkSessionTokenUser(key: string, token: string) {
    const sessionToken: string = (await this.redisService.getKey(
      key,
    )) as string;

    if (!sessionToken || sessionToken != token)
      throw new BadRequestException('session token expired');
  }

  async delSessionTokenUser(key: string) {
    await this.redisService.delKey(key);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisServcie {
  private logger: Logger;
  public redis: Redis;
  private duration: number = 60;
  constructor() {
    this.logger = new Logger(RedisServcie.name, { timestamp: true });
    this.redis = new Redis({
      port: process.env.REDIS_PORT as unknown as number,
      host: process.env.REDIS_HOST,
    });
    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
    });
    this.redis.on('error', (err) => {
      this.logger.error('redis error', err);
      this.redis.quit();
      process.exit(1);
    });
  }

  async setOtp(phone_number: string, otp: string): Promise<string> {
    const key = `user:${phone_number}`;
    const result = await this.redis.setex(key, this.duration, otp);

    return result;
  }

  async getOtp(key: string) {
    const otp = await this.redis.get(key);
    return otp;
  }

  async getTtlKey(key: string) {
    return await this.redis.ttl(key);
  }

  async delKey(key: string) {
    await this.redis.del(key);
  }

  async setSessionTokenUser(phone_number: string, token: string) {
    await this.redis.setex(`session_token:${phone_number}`, 300, token);
  }

  async getKey(key: string) {
    return await this.redis.get(key);
  }
}

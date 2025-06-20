import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from 'src/core/database/prisma.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';
import { SendOtpDto } from './dto/send-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private otpService: OtpService,
  ) {}
  async sendOtpUser(sendOtpDto: SendOtpDto) {
    try {
      const findUser = await this.prisma.user.findUnique({
        where: { phoneNumber: sendOtpDto.phoneNumber },
      });

      if (findUser) throw new ConflictException('phone_number already exists');

      const res = await this.otpService.sendOtp(sendOtpDto.phoneNumber);

      if (!res) throw new InternalServerErrorException('Server error');

      return { message: 'code sended' };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async verifyOtp(data: VerifyOtpDto) {
    try {
      const key = `user:${data.phoneNumber}`;

      const session_token = await this.otpService.verifyOtpSendedUser(
        key,
        data.code,
        data.phoneNumber,
      );

      return { session_token };
    } catch (error) {
      throw new HttpException(error.message, error.statusCode);
    }
  }

  async register(createAuthDto: CreateAuthDto) {
    try {
      const { session_token, ...userData } = createAuthDto;

      const findUser = await this.prisma.user.findUnique({
        where: { phoneNumber: createAuthDto.phoneNumber },
      });

      if (findUser) throw new ConflictException('phone_number already exists');

      const key = `session_token:${createAuthDto.phoneNumber}`;

      await this.otpService.checkSessionTokenUser(
        key,
        createAuthDto.session_token,
      );

      const hashedPassword = await bcrypt.hash(createAuthDto.password, 12);

      const user = await this.prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword,
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      const access_token = this.jwtService.sign({
        user_id: user.id,
        role: user.role,
      });

      await this.otpService.delSessionTokenUser(key);

      return { access_token, data: user };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async login(loginAuthDto: LoginAuthDto) {
    let findUser: any;

    try {
      if (loginAuthDto.username) {
        findUser = await this.prisma.user.findUniqueOrThrow({
          where: { username: loginAuthDto.username },
        });
      } else if (loginAuthDto.email) {
        findUser = await this.prisma.user.findUniqueOrThrow({
          where: { email: loginAuthDto.email },
        });

        if (!findUser.isVerifyEmail) {
          throw new BadRequestException('email not confirmed');
        }
      } else if (loginAuthDto.phoneNumber) {
        findUser = await this.prisma.user.findUniqueOrThrow({
          where: { phoneNumber: loginAuthDto.phoneNumber },
        });
      } else {
        throw new BadRequestException(
          'username, email or phone number must be provided',
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new NotFoundException('user not found');
    }

    try {
      const comparePassword = await bcrypt.compare(
        loginAuthDto.password as string,
        findUser.password,
      );

      if (!comparePassword) {
        throw new BadRequestException('invalid credentials');
      }

      const token = this.jwtService.sign({ user_id: findUser.id });

      return token;
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}

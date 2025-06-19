import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import fs from 'fs';
import { PrismaService } from 'src/core/database/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { EmailService } from './email.service';
import { OtpService } from '../auth/otp.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly optService: OtpService,
  ) {}
  async getProfile(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return { data: user };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async updateProfile(updateUserDto: UpdateUserDto, id: string) {
    try {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: {
          id,
        },
      });

      const updatedUserData = { ...user, ...updateUserDto };

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: updatedUserData,
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          updatedAt: true,
        },
      });

      return { data: updatedUser };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async updateAvatar(id: string, file_path: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id } });

        try {
          if (user?.avatar) {
            fs.unlinkSync(user.avatar);
          }
        } catch (error) {}

        await tx.user.update({
          where: { id },
          data: { avatar: file_path },
        });

        return { message: 'avatar updated' };
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async confirmEmail(id: string) {
    try {
      const userData = await this.prisma.user.findUnique({
        where: { id },
        select: { email: true, isEmailVerified: true },
      });

      if (!userData) {
        throw new NotFoundException('user not found');
      }
      if (userData.isEmailVerified) {
        throw new BadRequestException('email is already verified');
      }
      const token = this.jwtService.sign({ user_id: id }, { expiresIn: '2m' });

      const data = await this.emailService.sendVerificationEmail(
        userData.email,
        token,
      );

      return { message: 'verify link sended' };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async verifyEmail(token: string) {
    try {
      const { user_id } = await this.jwtService.verifyAsync(token);

      const userData = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: { email: true, isEmailVerified: true },
      });

      if (!userData) {
        throw new NotFoundException('user not found');
      }

      if (userData.isEmailVerified) {
        return `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; background-color: #d1ecf1; color: #0c5460; padding: 40px; }
                .container { max-width: 600px; margin: auto; background: #bee5eb; padding: 20px; border-radius: 8px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Email Already Verified</h1>
                <p>Your email address has already been verified.</p>
              </div>
            </body>
          </html>
        `;
      }

      await this.prisma.user.update({
        where: { id: user_id },
        data: { isEmailVerified: true },
      });

      return `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; background-color: #d4edda; color: #155724; padding: 40px; }
              .container { max-width: 600px; margin: auto; background: #c3e6cb; padding: 20px; border-radius: 8px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Email Verified Successfully</h1>
              <p>Thank you! Your email has been confirmed.</p>
            </div>
          </body>
        </html>
      `;
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async updatePassword(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });
      await this.optService.sendOtp(user?.phoneNumber as string);
      return { message: 'code sended' };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async changePassword(id: string, changePasswordDto: ChangePasswordDto) {
    try {
      const { session_token, new_password } = changePasswordDto;

      const findUser = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!findUser) throw new NotFoundException('user not found');

      const key = `session_token:${findUser.phoneNumber}`;

      await this.optService.checkSessionTokenUser(key, session_token);

      const hashedPassword = await bcrypt.hash(new_password, 12);

      await this.prisma.user.update({
        where: { id },
        data: { password: hashedPassword },
      });

      return { message: 'password updated' };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}

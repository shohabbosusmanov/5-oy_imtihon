import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { LoginAuthDto } from './dto/login-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  async sendOtpUser(@Body() sendOtpDto: SendOtpDto) {
    const response = await this.authService.sendOtpUser(sendOtpDto);

    return response;
  }

  @Post('verify-otp')
  async verifyOtp(@Body() data: VerifyOtpDto) {
    const session_token = await this.authService.verifyOtp(data);
    return { data: session_token };
  }

  @Post('register')
  async register(
    @Body() createAuthDto: CreateAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, data } =
      await this.authService.register(createAuthDto);
    res.cookie('access_token', access_token, {
      maxAge: 1.1 * 3600 * 1000,
      httpOnly: true,
    });

    return { data };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() loginAuthDto: LoginAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const access_token = await this.authService.login(loginAuthDto);
    res.cookie('access_token', access_token, {
      maxAge: 1.1 * 3600 * 1000,
      httpOnly: true,
    });

    return {};
  }

  @Get('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('access_token');
    return {};
  }
}

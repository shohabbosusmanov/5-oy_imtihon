import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { diskStorage } from 'multer';
import path from 'path';
import { JwtGuard } from 'src/common/guards/auth.guard';
import { SkipResponseInterceptor } from 'src/common/interseptors/response.interceptor';
import { v4 as uuid } from 'uuid';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtGuard)
  @Get('me')
  async getProfile(@Req() req: Request) {
    const id = req['user_id'];

    return await this.usersService.getProfile(id);
  }

  @UseGuards(JwtGuard)
  @Put('me')
  async updateProfile(
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: Request,
  ) {
    const id = req['user_id'];

    return await this.usersService.updateProfile(updateUserDto, id);
  }

  @UseGuards(JwtGuard)
  @Put('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/profile-avatars',
        filename: (req, file, cb) => {
          const extName = path.extname(file.originalname);
          const file_name = `${uuid()}${extName}`;

          const file_path = path.join('uploads', 'profile-avatars', file_name);

          req['file_name'] = file_name;
          req['file_path'] = file_path;
          cb(null, file_name);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (!allowedTypes.includes(file.mimetype)) {
          cb(new BadRequestException('only image files are allowed!'), false);
        } else {
          cb(null, true);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async updateAvatar(@Req() req: Request) {
    const id = req['user_id'];

    const file_path: string = req['file_path'];

    return await this.usersService.updateAvatar(id, file_path);
  }

  @UseGuards(JwtGuard)
  @Get('confirm-email')
  async confirmEmail(@Req() req: Request) {
    const id = req['user_id'];

    return await this.usersService.confirmEmail(id);
  }

  @SkipResponseInterceptor()
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return await this.usersService.verifyEmail(token);
  }

  @UseGuards(JwtGuard)
  @Get('update-password')
  async updatePassword(@Req() req: Request) {
    const id = req['user_id'];

    return await this.usersService.updatePassword(id);
  }

  @UseGuards(JwtGuard)
  @Post('change-password')
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const id = req['user_id'];

    return await this.usersService.changePassword(id, changePasswordDto);
  }
}

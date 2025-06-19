import { InjectQueue } from '@nestjs/bull';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Queue } from 'bull';
import { VideoService } from './video.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { UploadVideoDto } from './dto/upload-video.dto';
import { JwtGuard } from 'src/common/guards/auth.guard';
import { SkipResponseInterceptor } from 'src/common/interseptors/response.interceptor';
import { Request, Response } from 'express';
import { UpdateVideoDto } from './dto/update-video.dto';

@Controller('videos')
export class VideoController {
  constructor(
    private readonly videoService: VideoService,
    @InjectQueue('video-processing') private readonly videoQueue: Queue,
  ) {}

  @UseGuards(JwtGuard)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/videos',
        filename: (req, file, cb) => {
          const extName = path.extname(file.originalname);
          const fileName = `${uuid()}${extName}`;
          cb(null, fileName);
        },
      }),
    }),
  )
  async uploadVideo(
    @Req() req: Request,
    @Body() uploadVideoDto: UploadVideoDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req['user_id'];

    const job = await this.videoQueue.add('process', {
      userId,
      uploadVideoDto,
      file: {
        path: file.path,
        filename: file.filename,
        originalname: file.originalname,
      },
    });

    return {
      message: 'Video upload job added to queue',
      data: { job_id: job.id },
    };
  }

  @UseGuards(JwtGuard)
  @SkipResponseInterceptor()
  @Get('status/:jobId')
  async getVideoStatus(@Param('jobId') jobId: string) {
    const result = await this.videoService.getVideoStatus(jobId);
    if (!result) {
      return { status: 'processing' };
    }

    return {
      status: 'completed',
      video_id: result.videoId,
    };
  }

  @UseGuards(JwtGuard)
  @Get('/:id')
  async getVideoData(@Param('id') id: string) {
    return await this.videoService.getVideoData(id);
  }

  @SkipResponseInterceptor()
  @Get('watch/:url')
  async watchVideo(
    @Param('url') url: string,
    @Query('quality') quality: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const param = url;
    const contentRange = req.headers.range;
    await this.videoService.watchVideo(
      param,
      quality,
      contentRange as string,
      res,
    );
  }

  @UseGuards(JwtGuard)
  @Put('/:id/update')
  async updateVideo(
    @Param('id') id: string,
    @Body() updateVideoDto: UpdateVideoDto,
    @Req() req: Request,
  ) {
    const user_id = req['user_id'];

    return await this.videoService.updateVideo(user_id, id, updateVideoDto);
  }

  @UseGuards(JwtGuard)
  @Delete('/:id')
  async deleteVideo(@Param('id') id: string, @Req() req: Request) {
    const user_id = req['user_id'];

    return await this.videoService.deleteVideo(user_id, id);
  }
}

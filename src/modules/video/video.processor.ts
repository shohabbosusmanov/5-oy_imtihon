import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { VideoService } from './video.service';
import { UploadVideoDto } from './dto/upload-video.dto';
import { HttpException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';

@Processor('video-processing')
export class VideoProcessor {
  constructor(
    private readonly videoService: VideoService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('process')
  async handle(
    job: Job<{
      userId: string;

      uploadVideoDto: UploadVideoDto;
      file: { path: string; filename: string; originalname: string };
    }>,
  ) {
    try {
      const { userId, uploadVideoDto, file } = job.data;
      const fakeFile = {
        path: file.path,
        filename: file.filename,
      } as Express.Multer.File;

      const videoData = await this.videoService.uploadVideo(
        userId,
        uploadVideoDto,
        fakeFile,
      );

      await this.prisma.videoJobResult.create({
        data: {
          jobId: job.id as string,
          videoId: videoData.videoId,
        },
      });

      return true;
    } catch (error) {
      throw new HttpException(error.message, error.statusCode);
    }
  }
}

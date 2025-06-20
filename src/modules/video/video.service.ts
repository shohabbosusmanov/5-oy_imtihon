import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import fsp from 'fs/promises';
import path, { join } from 'path';
import { PrismaService } from 'src/core/database/prisma.service';
import { UploadVideoDto } from './dto/upload-video.dto';
import { Response } from 'express';
import { UpdateVideoDto } from './dto/update-video.dto';
import { CreateCommentDto } from '../comment/dto/create-comment.dto';
import { LikeType } from '@prisma/client';

@Injectable()
export class VideoService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadVideo(
    id: string,
    uploadVideoDto: UploadVideoDto,
    file: Express.Multer.File,
  ) {
    try {
      const baseUrl = process.env.SERVER_URL || 'http://localhost:4000';
      const inputPath = file.path;
      const baseName = path.parse(file.filename).name;
      const outputDir = path.join('uploads', 'videos', baseName);

      const metadata = await new Promise<ffmpeg.FfprobeData>(
        (resolve, reject) => {
          ffmpeg.ffprobe(inputPath, (err, data) => {
            if (err) return reject(err);
            resolve(data);
          });
        },
      );

      fs.mkdirSync(outputDir, { recursive: true });

      const videoStream = metadata.streams.find(
        (s) => s.codec_type === 'video',
      );
      const width = videoStream?.width ?? 0;
      const height = videoStream?.height ?? 0;

      const availableResolutions = [
        { name: '4320p', size: '7680x4320', height: 4320 },
        { name: '2160p', size: '3840x2160', height: 2160 },
        { name: '1080p', size: '1920x1080', height: 1080 },
        { name: '720p', size: '1280x720', height: 720 },
        { name: '480p', size: '854x480', height: 480 },
        { name: '360p', size: '640x360', height: 360 },
        { name: '240p', size: '426x240', height: 240 },
        { name: '144p', size: '256x144', height: 144 },
      ];

      const originalRes = availableResolutions.find(
        (res) => res.height === height,
      );
      const targetResolutions = availableResolutions.filter(
        (res) => res.height < height,
      );

      if (originalRes) {
        const originalTargetPath = path.join(
          outputDir,
          `${originalRes.name}.mp4`,
        );
        await fsp.copyFile(inputPath, originalTargetPath);
      }

      const resizePromises = targetResolutions.map((res) => {
        return new Promise<void>((resolve, reject) => {
          const outputPath = path.join(outputDir, `${res.name}.mp4`);
          ffmpeg(inputPath)
            .outputOptions('-preset fast')
            .size(res.size)
            .output(outputPath)
            .on('end', () => {
              resolve();
            })
            .on('error', (err) => {
              reject(err);
            })
            .run();
        });
      });

      const thumbnailPath = path.join(outputDir, 'thumbnail.jpg');
      const thumbnailPromise = new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .screenshots({
            timestamps: ['00:00:05'],
            filename: 'thumbnail.jpg',
            folder: outputDir,
            size: '1280x720',
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (err) => {
            reject(err);
          });
      });

      await Promise.all([...resizePromises, thumbnailPromise]);

      try {
        fs.unlinkSync(inputPath);
      } catch (error) {}

      const saved = await this.prisma.video.create({
        data: {
          title: uploadVideoDto.title,
          description: uploadVideoDto.description,
          thumbnail: `${baseUrl}/static/videos/${baseName}/thumbnail.jpg`,
          videoUrl: baseName,
          authorId: id,
        },
      });

      console.log(saved);

      return {
        message: 'video processed and saved',
        videoId: saved.id,
      };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async getVideoStatus(jobId: string) {
    try {
      const result = await this.prisma.videoJobResult.findUnique({
        where: { jobId },
        select: { videoId: true },
      });

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async getVideoData(id: string) {
    try {
      const video = await this.prisma.video.findUniqueOrThrow({
        where: { id },
        include: {
          author: {
            select: {
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          comments: true,
          likes: true,
          PlaylistVideo: true,
        },
      });

      return { data: video };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  getChunkProps(range: string, size: number) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
    const chunkSize = end - start + 1;

    return { start, end, chunkSize };
  }

  async watchVideo(url: string, quality: string, range: string, res: Response) {
    try {
      const video = await this.prisma.video.findFirst({
        where: { videoUrl: url },
      });

      if (video?.visibility != 'PUBLIC')
        throw new ForbiddenException('access to this video is forbidden');

      const basePath = path.join(process.cwd(), 'uploads', 'videos');
      const videoDir = path.join(basePath, url);
      const fileName = `${quality}.mp4`;
      const videoPath = path.join(videoDir, fileName);

      if (!fs.existsSync(videoDir)) {
        throw new NotFoundException('video not found');
      }

      if (!fs.existsSync(videoPath)) {
        throw new NotFoundException('video quality not found');
      }

      const { size } = fs.statSync(videoPath);

      if (!range) {
        range = `bytes=0-${Math.min(size - 1, 1048575)}`;
      }

      const { start, end, chunkSize } = this.getChunkProps(range, size);

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      });

      const stream = fs.createReadStream(videoPath, { start, end });

      stream.pipe(res);

      stream.on('error', (err) => {
        console.error('Stream error:', err);
        res.sendStatus(500);
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async updateVideo(
    user_id: string,
    id: string,
    updateVideoDto: UpdateVideoDto,
  ) {
    try {
      const videoData = await this.prisma.video.findUnique({ where: { id } });

      if (!videoData) throw new NotFoundException('video not found');

      if (videoData.authorId != user_id)
        throw new ForbiddenException('you are not the author of this video');

      const updatedVideoData = { ...videoData, ...updateVideoDto };

      const updatedVideo = await this.prisma.video.update({
        where: { id },
        data: updatedVideoData,
        include: {
          author: {
            select: {
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          comments: true,
          likes: true,
          PlaylistVideo: true,
        },
      });

      return { message: 'video updated', data: updatedVideo };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async deleteVideo(user_id: string, id: string) {
    try {
      const video = await this.prisma.video.findUnique({ where: { id } });

      if (video?.authorId != user_id)
        throw new ForbiddenException('you are not the author of this video');

      const deletedVideo = await this.prisma.video.delete({ where: { id } });

      try {
        const folderPath = path.join(
          process.cwd(),
          'uploads',
          'videos',
          `${deletedVideo.videoUrl}`,
        );
        fs.rmSync(folderPath, { recursive: true, force: true });
      } catch (error) {}

      return { message: 'video deleted', data: deletedVideo };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async likeVideo(user_id: string, video_id: string) {
    try {
      const video = await this.prisma.video.findUnique({
        where: { id: video_id },
        include: {
          author: {
            select: {
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          comments: true,
          likes: true,
          PlaylistVideo: true,
        },
      });

      if (!video) throw new NotFoundException('video not found');

      const existingLike = await this.prisma.like.findUnique({
        where: {
          userId_videoId_type: {
            userId: user_id,
            videoId: video_id,
            type: LikeType.LIKE,
          },
        },
      });

      const existingDislike = await this.prisma.like.findUnique({
        where: {
          userId_videoId_type: {
            userId: user_id,
            videoId: video_id,
            type: LikeType.DISLIKE,
          },
        },
      });

      if (existingLike) {
        throw new BadRequestException('You have already liked this video');
      }

      if (existingDislike) {
        await this.prisma.like.delete({
          where: {
            id: existingDislike.id,
          },
        });
      }

      await this.prisma.video.update({
        where: { id: video_id },
        data: {
          likesCount: { increment: 1 },
        },
      });

      const like = await this.prisma.like.create({
        data: { type: LikeType.LIKE, videoId: video_id, userId: user_id },
      });

      return { data: like };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async dislikeVideo(user_id: string, video_id: string) {
    try {
      const video = await this.prisma.video.findUnique({
        where: { id: video_id },
      });

      if (!video) {
        throw new NotFoundException('video not found');
      }

      const existingLike = await this.prisma.like.findUnique({
        where: {
          userId_videoId_type: {
            userId: user_id,
            videoId: video_id,
            type: LikeType.LIKE,
          },
        },
      });

      const existingDislike = await this.prisma.like.findUnique({
        where: {
          userId_videoId_type: {
            userId: user_id,
            videoId: video_id,
            type: LikeType.DISLIKE,
          },
        },
      });

      if (existingDislike) {
        throw new BadRequestException('You have already disliked this video');
      }

      if (existingLike) {
        await this.prisma.like.delete({
          where: { id: existingLike.id },
        });

        if (video.likesCount > 0) {
          await this.prisma.video.update({
            where: { id: video_id },
            data: {
              likesCount: { decrement: 1 },
            },
          });
        }
      }

      const dislike = await this.prisma.like.create({
        data: {
          type: LikeType.DISLIKE,
          videoId: video_id,
          userId: user_id,
        },
      });

      return { data: dislike };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}

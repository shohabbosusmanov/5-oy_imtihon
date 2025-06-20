import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { LikeType } from '@prisma/client';

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  async addComment(
    id: string,
    video_id: string,
    createCommentDto: CreateCommentDto,
  ) {
    try {
      const comment = await this.prisma.comment.create({
        data: { ...createCommentDto, authorId: id, videoId: video_id },
      });

      return { message: 'comment added', data: comment };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async getComments(
    video_id: string,
    limit: number,
    page: number,
    sort: 'asc' | 'desc',
  ) {
    try {
      const total = await this.prisma.comment.count({
        where: { videoId: video_id },
      });
      const skip = (page - 1) * limit;

      const comments = await this.prisma.comment.findMany({
        where: {
          videoId: video_id,
        },
        orderBy: {
          createdAt: sort,
        },
        skip,
        take: limit,
        select: {
          id: true,
          content: true,
          likesCount: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
        },
      });

      const pages = Math.ceil(total / limit);

      return { data: { ...comments, total, pages } };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async likeComment(user_id: string, comment_id: string) {
    try {
      const comment = await this.prisma.comment.findUnique({
        where: { id: comment_id },
      });
      if (!comment) throw new NotFoundException('comment not found');

      const existingLike = await this.prisma.like.findUnique({
        where: {
          userId_commentId_type: {
            userId: user_id,
            commentId: comment_id,
            type: LikeType.LIKE,
          },
        },
      });

      if (existingLike) {
        throw new BadRequestException('you have already liked this comment');
      }

      await this.prisma.comment.update({
        where: { id: comment_id },
        data: {
          likesCount: { increment: 1 },
        },
      });

      const like = await this.prisma.like.create({
        data: { type: LikeType.LIKE, commentId: comment_id, userId: user_id },
      });

      return { data: like };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async dislikeComment(user_id: string, comment_id: string) {
    try {
      const comment = await this.prisma.comment.findUnique({
        where: { id: comment_id },
      });

      if (!comment) {
        throw new NotFoundException('comment not found');
      }

      const existingLike = await this.prisma.like.findUnique({
        where: {
          userId_commentId_type: {
            userId: user_id,
            commentId: comment_id,
            type: LikeType.LIKE,
          },
        },
      });

      const existingDislike = await this.prisma.like.findUnique({
        where: {
          userId_commentId_type: {
            userId: user_id,
            commentId: comment_id,
            type: LikeType.DISLIKE,
          },
        },
      });

      if (existingDislike) {
        throw new BadRequestException('you have already disliked this comment');
      }

      if (existingLike) {
        await this.prisma.like.delete({
          where: {
            id: existingLike.id,
          },
        });

        if (comment.likesCount > 0) {
          await this.prisma.comment.update({
            where: { id: comment_id },
            data: {
              likesCount: { decrement: 1 },
            },
          });
        }
      }

      const dislike = await this.prisma.like.create({
        data: {
          type: LikeType.DISLIKE,
          commentId: comment_id,
          userId: user_id,
        },
      });

      return { data: dislike };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}

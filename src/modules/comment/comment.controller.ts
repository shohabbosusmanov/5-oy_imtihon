import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from 'src/common/guards/auth.guard';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@UseGuards(JwtGuard)
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post('/:video_id')
  async addComment(
    @Param('video_id') video_id: string,
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: Request,
  ) {
    const id = req['user_id'];

    return await this.commentService.addComment(id, video_id, createCommentDto);
  }

  @Get('/:video_id')
  async getComments(
    @Param('video_id') video_id: string,
    @Query('limit') limit: number,
    @Query('page') page: number,
    @Query('sort') sort: 'asc' | 'desc',
  ) {
    return await this.commentService.getComments(video_id, limit, page, sort);
  }

  @UseGuards(JwtGuard)
  @Get('/like/:comment_id')
  async likeComment(
    @Param('comment_id') comment_id: string,
    @Req() req: Request,
  ) {
    const user_id = req['user_id'];

    return await this.commentService.likeComment(user_id, comment_id);
  }

  @UseGuards(JwtGuard)
  @Get('dislike/:comment_id')
  async dislikeComment(
    @Param('comment_id') comment_id: string,
    @Req() req: Request,
  ) {
    const user_id = req['user_id'];

    return await this.commentService.dislikeComment(user_id, comment_id);
  }
}

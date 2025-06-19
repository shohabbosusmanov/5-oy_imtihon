import { Module } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';
import { BullModule } from '@nestjs/bull';
import { VideoProcessor } from './video.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'video-processing' })],
  controllers: [VideoController],
  providers: [VideoService, VideoProcessor],
})
export class VideoModule {}

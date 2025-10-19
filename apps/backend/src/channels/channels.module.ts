import { Module } from '@nestjs/common';
import { ChannelsResolver } from './channels.resolver';
import { ChannelsService } from './channels.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ChannelsResolver, ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}

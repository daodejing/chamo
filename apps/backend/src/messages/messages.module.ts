import { Module } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { MessagesService } from './messages.service';
import { MessagesResolver } from './messages.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { PUB_SUB } from './messages.constants';

@Module({
  imports: [PrismaModule],
  providers: [
    MessagesService,
    MessagesResolver,
    {
      provide: PUB_SUB,
      useValue: new PubSub(),
    },
  ],
  exports: [MessagesService],
})
export class MessagesModule {}

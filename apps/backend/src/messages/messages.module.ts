import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PubSub } from 'graphql-subscriptions';
import { MessagesService } from './messages.service';
import { MessagesResolver } from './messages.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GqlSubscriptionAuthGuard } from '../auth/gql-subscription-auth.guard';
import { PUB_SUB } from './messages.constants';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        'dev-jwt-secret-change-in-production-use-openssl-rand-base64-32',
    }),
  ],
  providers: [
    MessagesService,
    MessagesResolver,
    GqlSubscriptionAuthGuard,
    {
      provide: PUB_SUB,
      useValue: new PubSub(),
    },
  ],
  exports: [MessagesService],
})
export class MessagesModule {}

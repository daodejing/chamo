import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MessagesModule } from './messages/messages.module';
import { ChannelsModule } from './channels/channels.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { TranslationModule } from './translation/translation.module';
import { TranslationThrottlerGuard } from './translation/translation-throttler.guard';

@Module({
  imports: [
    // GraphQL configuration
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      subscriptions: {
        'graphql-ws': true,
      },
    }),
    // Application modules
    PrismaModule,
    AuthModule,
    MessagesModule,
    ChannelsModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        limit: 10,
        ttl: 60_000,
      },
      {
        name: 'long',
        limit: 100,
        ttl: 86_400_000,
      },
    ]),
    TranslationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: TranslationThrottlerGuard,
    },
  ],
})
export class AppModule {}

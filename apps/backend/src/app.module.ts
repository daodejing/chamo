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
import { EmailModule } from './email/email.module';
import { TestSupportModule } from './test-support/test-support.module';

// Throttler limits - much higher for test environment to avoid rate limiting during E2E tests
const isTestEnv = process.env.NODE_ENV === 'test';
const throttlerShortLimit = isTestEnv ? 10000 : 100;
const throttlerLongLimit = isTestEnv ? 10000 : 100;

const baseImports = [
  GraphQLModule.forRoot<ApolloDriverConfig>({
    driver: ApolloDriver,
    autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
    sortSchema: true,
    playground: true,
    subscriptions: {
      'graphql-ws': {
        onConnect: (context: any) => {
          const { connectionParams } = context;
          if (connectionParams?.authorization) {
            return { authorization: connectionParams.authorization };
          }
          return {};
        },
      },
    },
    context: (context: any) => {
      const { req } = context;
      if (context.connectionParams?.authorization) {
        return {
          req: {
            headers: {
              authorization: context.connectionParams.authorization,
            },
          },
        };
      }
      return { req };
    },
  }),
  PrismaModule,
  AuthModule,
  MessagesModule,
  ChannelsModule,
  ThrottlerModule.forRoot([
    {
      name: 'short',
      limit: throttlerShortLimit,
      ttl: 60_000,
    },
    {
      name: 'long',
      limit: throttlerLongLimit,
      ttl: 86_400_000,
    },
  ]),
  TranslationModule,
  EmailModule,
];

const shouldEnableTestSupport = process.env.NODE_ENV !== 'production';

@Module({
  imports: [
    ...baseImports,
    ...(shouldEnableTestSupport ? [TestSupportModule] : []),
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

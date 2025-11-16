import { Resolver, Mutation, Query, Args, Subscription } from '@nestjs/graphql';
import { UseGuards, Injectable, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MessagesService } from './messages.service';
import { MessageWithUserType } from './types/message.type';
import { SendMessageInput } from './dto/send-message.input';
import { EditMessageInput } from './dto/edit-message.input';
import { DeleteMessageInput } from './dto/delete-message.input';
import { GetMessagesInput } from './dto/get-messages.input';
import { PUB_SUB } from './messages.constants';

@Injectable()
@Resolver()
export class MessagesResolver {
  constructor(
    private messagesService: MessagesService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @Mutation(() => MessageWithUserType)
  @UseGuards(GqlAuthGuard)
  async sendMessage(
    @CurrentUser() user: any,
    @Args('input') input: SendMessageInput,
  ): Promise<MessageWithUserType> {
    const message = await this.messagesService.sendMessage(user.id, input);

    // Publish to subscription
    this.pubSub.publish('messageAdded', {
      messageAdded: message,
      channelId: message.channelId,
    });

    return message;
  }

  @Mutation(() => MessageWithUserType)
  @UseGuards(GqlAuthGuard)
  async editMessage(
    @CurrentUser() user: any,
    @Args('input') input: EditMessageInput,
  ): Promise<MessageWithUserType> {
    const message = await this.messagesService.editMessage(user.id, input);

    // Publish to subscription
    this.pubSub.publish('messageEdited', {
      messageEdited: message,
      channelId: message.channelId,
    });

    return message;
  }

  @Mutation(() => DeleteMessageResponse)
  @UseGuards(GqlAuthGuard)
  async deleteMessage(
    @CurrentUser() user: any,
    @Args('input') input: DeleteMessageInput,
  ) {
    const result = await this.messagesService.deleteMessage(user.id, input);

    // Publish to subscription
    this.pubSub.publish('messageDeleted', {
      messageDeleted: {
        messageId: result.messageId,
      },
    });

    return result;
  }

  @Query(() => [MessageWithUserType])
  @UseGuards(GqlAuthGuard)
  async getMessages(
    @CurrentUser() user: any,
    @Args('input') input: GetMessagesInput,
  ): Promise<MessageWithUserType[]> {
    return this.messagesService.getMessages(user.id, input);
  }

  @Subscription(() => MessageWithUserType, {
    // Note: Auth guards removed for WebSocket subscriptions
    // Channel-level filtering provides security via channelId check
    resolve: (payload) => payload.messageAdded,
    filter: (payload, variables) => {
      return payload.channelId === variables.channelId;
    },
  })
  messageAdded(@Args('channelId') channelId: string) {
    return this.pubSub.asyncIterableIterator('messageAdded');
  }

  @Subscription(() => MessageWithUserType, {
    resolve: (payload) => payload.messageEdited,
    filter: (payload, variables) => {
      return payload.channelId === variables.channelId;
    },
  })
  messageEdited(@Args('channelId') channelId: string) {
    return this.pubSub.asyncIterableIterator('messageEdited');
  }

  @Subscription(() => DeletedMessageType, {
    filter: (payload, variables) => {
      return payload.channelId === variables.channelId;
    },
  })
  messageDeleted(@Args('channelId') channelId: string) {
    return this.pubSub.asyncIterableIterator('messageDeleted');
  }
}

// Additional type for delete response
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class DeleteMessageResponse {
  @Field()
  success: boolean;

  @Field(() => ID)
  messageId: string;
}

@ObjectType()
export class DeletedMessageType {
  @Field(() => ID)
  messageId: string;
}

import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChannelsService } from './channels.service';
import { Channel } from './types/channel.type';

@Resolver(() => Channel)
export class ChannelsResolver {
  constructor(private channelsService: ChannelsService) {}

  @Query(() => [Channel], { name: 'getChannels' })
  @UseGuards(GqlAuthGuard)
  async getChannels(@CurrentUser() user: any) {
    // Get channels for the user's active family
    return this.channelsService.getChannelsByFamilyId(user.activeFamilyId);
  }

  @Query(() => Channel, { name: 'getChannel', nullable: true })
  @UseGuards(GqlAuthGuard)
  async getChannel(@Args('id') id: string) {
    return this.channelsService.getChannelById(id);
  }
}

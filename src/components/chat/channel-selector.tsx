/**
 * ChannelSelector Component
 * Dropdown menu for switching between family channels
 */

'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Hash, ChevronDown } from 'lucide-react';

export interface Channel {
  id: string;
  familyId: string;
  name: string;
  description?: string;
  icon?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface ChannelSelectorProps {
  channels: Channel[];
  currentChannelId: string;
  onChannelChange: (channelId: string) => void;
}

export function ChannelSelector({
  channels,
  currentChannelId,
  onChannelChange,
}: ChannelSelectorProps) {
  const currentChannel = channels.find((c) => c.id === currentChannelId);

  return (
    <div className="border-b bg-card/50 px-4 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-auto py-2 px-3 rounded-xl hover:bg-muted"
          >
            <div className="flex items-center gap-2">
              {currentChannel?.icon && (
                <span className="text-lg">{currentChannel.icon}</span>
              )}
              <div className="text-left">
                <div className="flex items-center gap-1">
                  <Hash className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">
                    {currentChannel?.name || 'Select a channel'}
                  </span>
                </div>
                {currentChannel?.description && (
                  <p className="text-xs text-muted-foreground">
                    {currentChannel.description}
                  </p>
                )}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          {channels.map((channel) => (
            <DropdownMenuItem
              key={channel.id}
              onClick={() => onChannelChange(channel.id)}
              className={`p-3 cursor-pointer ${
                channel.id === currentChannelId ? 'bg-accent' : ''
              }`}
            >
              <div className="flex items-center gap-3 w-full">
                {channel.icon && (
                  <span className="text-xl">{channel.icon}</span>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <Hash className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm font-medium">{channel.name}</span>
                  </div>
                  {channel.description && (
                    <p className="text-xs text-muted-foreground">
                      {channel.description}
                    </p>
                  )}
                </div>
                {channel.id === currentChannelId && (
                  <Badge variant="secondary" className="text-xs">
                    Selected
                  </Badge>
                )}
              </div>
            </DropdownMenuItem>
          ))}
          {channels.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">
              No channels available
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

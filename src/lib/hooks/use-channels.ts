'use client';

import { useQuery } from '@apollo/client/react';
import { GET_CHANNELS_QUERY } from '../graphql/operations';
import type { GetChannelsQuery } from '../graphql/generated/graphql';

interface Channel {
  id: string;
  familyId: string;
  name: string;
  description: string | null;
  icon: string | null;
  createdById: string;
  isDefault: boolean;
  createdAt: string;
}

/**
 * Hook to fetch channels for the authenticated user's family
 * Note: Authentication headers are automatically added by Apollo Client's authLink
 */
export function useChannels() {
  const { data, loading, error, refetch } = useQuery<GetChannelsQuery>(GET_CHANNELS_QUERY);

  return {
    channels: (data?.getChannels || []) as Channel[],
    loading,
    error,
    refetch,
  };
}

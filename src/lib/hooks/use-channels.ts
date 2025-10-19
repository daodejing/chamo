'use client';

import { useQuery } from '@apollo/client/react';
import { GET_CHANNELS_QUERY } from '../graphql/operations';
import { getAuthHeader } from '../graphql/client';

interface Channel {
  id: string;
  familyId: string;
  name: string;
  description: string | null;
  icon: string | null;
  createdById: string;
  isDefault: boolean;
  createdAt: Date;
}

/**
 * Hook to fetch channels for the authenticated user's family
 */
export function useChannels() {
  const { data, loading, error, refetch } = useQuery(GET_CHANNELS_QUERY, {
    context: {
      headers: getAuthHeader(),
    },
  });

  return {
    channels: (data?.getChannels || []) as Channel[],
    loading,
    error,
    refetch,
  };
}

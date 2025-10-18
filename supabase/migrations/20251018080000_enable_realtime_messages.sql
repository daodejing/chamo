-- Enable Realtime for messages table
-- Required for real-time message delivery via WebSocket subscriptions

ALTER PUBLICATION supabase_realtime ADD TABLE messages;

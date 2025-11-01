## Local Realtime Messaging Debug Notes

- The NestJS backend must be running with subscriptions enabled. Confirm `pnpm --filter backend start:dev` is active and shows `🚀 Server running on http://0.0.0.0:4000/graphql` (`apps/backend/src/main.ts`).
- The frontend needs matching endpoints. Check `.env.local` (or `.env.development`) for:
  - `NEXT_PUBLIC_GRAPHQL_HTTP_URL=http://localhost:4000/graphql`
  - `NEXT_PUBLIC_GRAPHQL_WS_URL=ws://localhost:4000/graphql`
  and restart `pnpm dev` after any changes.
- Inspect the WebSocket handshake in DevTools → Network → WS. A successful connection to `ws://localhost:4000/graphql` is required; HTTP 401/403 indicates missing/invalid auth headers or CORS misconfiguration.
- Ensure the browser has the access token stored after login. The Apollo `GraphQLWsLink` sends `authorization: Bearer <token>` (`src/lib/graphql/client.ts`); clearing storage requires re-login before subscriptions work.
- If the socket connects but no updates arrive, check backend logs around mutation time to verify `MessagesResolver` publishes to the `messageAdded` channel and that no runtime errors occur in `MessagesService`.

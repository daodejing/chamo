import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

function normalizeOrigins(origins: string[]): string[] {
  return origins
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function buildCorsOptions(allowedOrigins: string[]): CorsOptions {
  const normalizedOrigins = normalizeOrigins(allowedOrigins);

  const formatAllowedList = () =>
    normalizedOrigins.length > 0 ? normalizedOrigins.join(', ') : 'No origins configured';

  return {
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (normalizedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(
          `Origin ${origin} not allowed by CORS. Allowed origins: ${formatAllowedList()}`,
        ),
      );
    },
    credentials: true,
  };
}

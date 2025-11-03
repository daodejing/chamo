import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Validates required environment variables at startup.
 * Fails fast if any critical variables are missing.
 */
function validateEnvironment() {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'REFRESH_TOKEN_SECRET',
    'CORS_ALLOWED_ORIGINS',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ FATAL: Missing required environment variables:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('\nPlease set these variables in apps/backend/.env');
    process.exit(1); // Fail fast
  }

  // Warn about insecure default values
  if (
    process.env.JWT_SECRET?.includes('dev-jwt-secret') ||
    process.env.REFRESH_TOKEN_SECRET?.includes('dev-refresh-secret')
  ) {
    console.warn(
      '⚠️  WARNING: Using development JWT secrets. Generate secure secrets for production!',
    );
    console.warn('   Run: openssl rand -base64 32');
  }
}

async function bootstrap() {
  // Validate environment before starting
  validateEnvironment();

  const app = await NestFactory.create(AppModule);

  // Enable CORS - Parse allowed origins from environment variable
  const allowedOrigins = process.env
    .CORS_ALLOWED_ORIGINS!.split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(
          new Error(
            `Origin ${origin} not allowed by CORS. Allowed origins: ${allowedOrigins.join(', ')}`,
          ),
        );
      }
    },
    credentials: true,
  });

  // Enable validation pipes for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server running on http://0.0.0.0:${port}/graphql`);
}
bootstrap();

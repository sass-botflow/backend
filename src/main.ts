import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { registerProcessDiagnostics } from './common/diagnostics/process-diagnostics';
import { registerEvolutionStartupDiagnostics } from './common/diagnostics/evolution-startup-diagnostics';

registerProcessDiagnostics();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const corsOrigins = (process.env.CORS_ORIGIN ?? 'https://botflow.ink')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const swagger = new DocumentBuilder()
    .setTitle('BotFlow API')
    .setDescription('AI automation platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 8000;
  await app.listen(port);

  void registerEvolutionStartupDiagnostics();

  const channelRoutes = Object.keys(document.paths).filter((path) =>
    path.startsWith('/api/channels'),
  );
  console.log(`BotFlow API running on port ${port}`);
  console.log(`Build commit: ${process.env.BUILD_COMMIT ?? 'unknown'}`);
  console.log(
    channelRoutes.length > 0
      ? `Channels module registered (${channelRoutes.length} routes)`
      : 'WARNING: Channels module routes not registered',
  );
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error('[FATAL] Bootstrap failed', message);
  process.exit(1);
});

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { registerProcessDiagnostics } from './common/diagnostics/process-diagnostics';
import {
  assertProductionRuntimeConfig,
  getRuntimeConfigSnapshot,
  logRuntimeConfigStartup,
  logMetaRedirectUri,
} from './common/config/runtime-config';

registerProcessDiagnostics();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const runtime = getRuntimeConfigSnapshot(configService);
  logRuntimeConfigStartup(runtime);
  logMetaRedirectUri(configService);
  assertProductionRuntimeConfig(configService);

  const corsOrigins = (configService.get<string>('CORS_ORIGIN') ?? 'https://botflow.ink')
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

  const port = configService.get<string>('PORT') ?? '8000';
  await app.listen(port);

  const whatsappRoutes = Object.keys(document.paths).filter((path) =>
    path.startsWith('/api/channels/whatsapp'),
  );
  console.log(`BotFlow API running on port ${port}`);
  console.log(
    whatsappRoutes.length > 0
      ? `WhatsApp Evolution module registered (${whatsappRoutes.length} routes)`
      : 'WARNING: WhatsApp routes not registered',
  );
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error('[FATAL] Bootstrap failed', message);
  process.exit(1);
});

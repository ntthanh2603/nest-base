import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT ?? 3000;

  await app.listen(port);
  const logger = new Logger('Application');
  logger.log(`Application is running on url http://localhost:${port}`);
}
void bootstrap();

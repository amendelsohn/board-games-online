import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { connect } from 'database/bg-database/mongo/mongo-client';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  connect();
  await app.listen(8080);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { registerAllGames } from './games/register-games';
import { GamesRegistry } from './games/games-registry.service';

const PORT = Number(process.env.PORT ?? 8080);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.enableCors({
    origin: [WEB_ORIGIN, 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Register every game module with the registry before listening.
  const registry = app.get(GamesRegistry);
  registerAllGames(registry);

  await app.listen(PORT);
  console.log(`@bgo/server listening on http://localhost:${PORT}`);
}

void bootstrap();

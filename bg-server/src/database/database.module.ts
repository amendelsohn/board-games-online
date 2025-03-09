import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { Player, Table, GameState } from './entities';
import * as path from 'path';

// Use a path relative to the project root
const rootDir = path.resolve(__dirname, '../../');
const dbPath = path.join(rootDir, 'database.sqlite');

console.log('Database path:', dbPath);

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: dbPath, // Store in bg-server root directory
      entities: [Player, Table, GameState],
      synchronize: true, // Set to false in production
      extra: {
        pragma: {
          journal_mode: 'WAL',
        },
      },
    }),
  ],
})
export class DatabaseModule {}

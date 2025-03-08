import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { Player, Table, GameState } from './entities';

// Get the home directory for the current user
const homeDir = process.env.HOME || process.env.USERPROFILE;
const dbPath = join(homeDir, '.bg-database.sqlite');

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: dbPath, // Store in user's home directory
      entities: [Player, Table, GameState],
      synchronize: true, // Set to false in production
    }),
  ],
})
export class DatabaseModule {}

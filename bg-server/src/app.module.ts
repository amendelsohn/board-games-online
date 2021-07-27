import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TableController } from './table/table.controller';
import { TableService } from './table/table.service';

@Module({
  imports: [],
  controllers: [AppController, TableController],
  providers: [AppService, TableService],
})
export class AppModule {}

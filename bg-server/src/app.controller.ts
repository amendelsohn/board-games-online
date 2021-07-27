import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("heartbeat")
  heartbeat(): string {
    return `bg-server is alive as of: [${Date.now().toLocaleString()}`;
  }

}

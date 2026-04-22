import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('heartbeat')
  heartbeat(): { ok: true; at: number } {
    return { ok: true, at: Date.now() };
  }
}

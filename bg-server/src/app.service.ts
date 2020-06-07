import { Injectable } from '@nestjs/common';
import Table from './table/Table';
import Player from './player/Player';

@Injectable()
export class AppService {
  getPlayer(): Player {
    let testPlayer: Player = {
      id: "1",
      name: "tester"
    };
    return testPlayer;
  }
  
  getTable(): Table {
    let testTable : Table = {
      id: "0",
      player_ids: ["1", "2"],
      game_state_id: "Test_State"
    };
    return testTable;
  }
}

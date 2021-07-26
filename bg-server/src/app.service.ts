import { Injectable } from '@nestjs/common';
import Table from './table/Table';
import Player from './player/Player';
import { TableModel } from 'database/bg-database/tables/tables.model';

@Injectable()
export class AppService {
  getPlayer(): Player {
    let testPlayer: Player = {
      id: "1",
      name: "tester"
    };
    return testPlayer;
  }
  
  async getTable(): Promise<Table> {
    let testTable : Table = {
      table_id: "0",
      player_ids: ["player_1", "player_2"],
      game_state_id: "tic_tac_toe_state"
    };

    return await TableModel.findOne({id: 0});
  }
    
  initTable(): Table {
    let testTable : Table = {
      table_id: "0",
      player_ids: ["player_1", "player_2"],
      game_state_id: "test_tic_tac_toe_state"
    };

    TableModel.create(testTable);

    return testTable;
  }
}

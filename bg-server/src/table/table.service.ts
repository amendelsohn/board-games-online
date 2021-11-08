import { Injectable, NotFoundException } from '@nestjs/common';
import { TableModel } from 'database/bg-database/tables/tables.model';
import { ITableDocument } from 'database/bg-database/tables/tables.types';
import Table from './Table';

@Injectable()
export class TableService {

  async getTable(table_id: string): Promise<Table> {
    const table = await TableService.getTableDocument(table_id);
    return table.toObject() as Table;
  }

  async createTable(table: Table): Promise<Table> {
    const existingTable = await TableModel.findOne(table).exec();
    if (!!existingTable) {
      return Promise.reject();
    }

    const tableToCreate = new TableModel(table);
    return await tableToCreate.save();
  }

  async addPlayers(table_id: string, player_ids: string[]): Promise<Table> {
    const table = await TableService.getTableDocument(table_id);
    table.player_ids = [...new Set([...table.player_ids, ...player_ids])];
    
    return await table.save();;
  }

  private static getTableDocument(table_id: string): Promise<ITableDocument> {
    return TableModel.findOne({table_id}).exec();
  }
}

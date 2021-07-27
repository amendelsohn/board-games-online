import { Injectable, NotFoundException } from '@nestjs/common';
import { TableModel } from 'database/bg-database/tables/tables.model';
import Table from './Table';

@Injectable()
export class TableService {

  async getTable(table_id: string): Promise<Table> {
    const found = await TableModel.findOne({table_id}).exec();
    return found.toObject() as Table;
  }

  async createTable(table: Table): Promise<Table> {
    const tableToCreate = new TableModel(table);
    return await tableToCreate.save();
  }
}

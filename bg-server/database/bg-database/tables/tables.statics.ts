import { ITableDocument, ITableModel } from "./tables.types";
import Table from "src/table/Table";
export async function findOne(
  this: ITableModel,
  tableId: string
): Promise<ITableDocument> {
  const record = await this.findOne({ id: tableId });
  if (record) {
    return record;
  } else {
    return Promise.reject();
  }
}


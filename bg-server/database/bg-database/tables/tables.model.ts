import { model } from "mongoose";
import { ITableDocument } from "./tables.types";
import TableSchema from "./tables.schema";
export const TableModel = model<ITableDocument>("Table", TableSchema);

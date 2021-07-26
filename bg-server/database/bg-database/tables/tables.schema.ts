import { Schema } from "mongoose";
import { setPlayerIds } from "./tables.methods";
import { findOne } from "./tables.statics";
import { create } from "domain";
const TableSchema = new Schema({
    id: String,
    player_ids: [String],
    game_state_id: String,
});

TableSchema.statics.create = create;
TableSchema.statics.findOne = findOne;

TableSchema.methods = setPlayerIds;

export default TableSchema;

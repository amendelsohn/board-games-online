import { Schema } from "mongoose";
import { setPlayerIds } from "./tables.methods";
// import { findOne } from "./tables.statics";
import { create } from "domain";
const TableSchema = new Schema({
    table_id: {
        type: String,
        required: true
    },
    player_ids: [String],
    game_state_id: String,
});

TableSchema.statics.create = create;
// TableSchema.statics.findOne = findOne;

TableSchema.methods = setPlayerIds;

export default TableSchema;

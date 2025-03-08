import { Schema } from 'mongoose';
import { tableMethods } from './tables.methods';
// import { findOne } from "./tables.statics";
import { create } from 'domain';

const TableSchema = new Schema(
  {
    table_id: {
      type: String,
      required: true,
    },
    join_code: {
      type: String,
      required: true,
      unique: true,
    },
    player_ids: [String],
    game_state_id: String,
    host_player_id: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['waiting', 'playing', 'finished'],
      default: 'waiting',
    },
    game_type: {
      type: String,
      required: true,
      default: 'tic-tac-toe',
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
);

TableSchema.statics.create = create;
// TableSchema.statics.findOne = findOne;

TableSchema.methods = tableMethods;

export default TableSchema;

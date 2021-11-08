import { Schema } from "mongoose";

import { create } from "domain";

const PlayerSchema = new Schema({
    player_id: {
        type: String,
        required: true
    },
    name: String,
});

PlayerSchema.statics.create = create;

export default PlayerSchema;

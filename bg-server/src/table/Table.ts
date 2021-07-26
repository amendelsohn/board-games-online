import { PlayerId } from '../player/Player';

type Table = {
    table_id: string;
    player_ids: PlayerId[];
    game_state_id: string;
}

export default Table;

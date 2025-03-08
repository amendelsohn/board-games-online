import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('game_states')
export class GameState {
  @PrimaryColumn()
  id: string;

  @Column()
  current_player: string;

  @Column({ default: false })
  is_game_over: boolean;

  @Column('simple-array', { default: '' })
  winning_players: string[];

  @Column('simple-array', { default: '' })
  losing_players: string[];

  @Column('simple-json', { nullable: true })
  game_specific_state: any;
}

import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tables')
export class Table {
  @PrimaryColumn()
  table_id: string;

  @Column({ unique: true })
  join_code: string;

  @Column('simple-array')
  player_ids: string[];

  @Column({ nullable: true })
  game_state_id: string;

  @Column('simple-json', { nullable: true })
  game_state_data: any;

  @Column()
  host_player_id: string;

  @Column({
    type: 'varchar',
    default: 'waiting',
  })
  status: 'waiting' | 'playing' | 'finished';

  @Column({ default: 'tic-tac-toe' })
  game_type: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}

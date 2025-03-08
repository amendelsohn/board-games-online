import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('players')
export class Player {
  @PrimaryColumn()
  player_id: string;

  @Column()
  name: string;
}

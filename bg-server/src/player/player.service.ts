import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from '../database/entities';
import { v4 as uuidv4 } from 'uuid';
import PlayerType from './Player';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private playerRepository: Repository<Player>,
  ) {}

  async getPlayer(player_id: string): Promise<PlayerType> {
    const found = await this.playerRepository.findOne({ player_id });
    if (!found) {
      throw new NotFoundException(`Player with ID ${player_id} not found`);
    }
    return found as PlayerType;
  }

  async createPlayer(name: string = 'Player'): Promise<PlayerType> {
    const player = this.playerRepository.create({
      player_id: uuidv4(),
      name: name || `Player-${Math.floor(Math.random() * 1000)}`,
    });

    return (await this.playerRepository.save(player)) as PlayerType;
  }

  async updatePlayerName(player_id: string, name: string): Promise<PlayerType> {
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('Player name cannot be empty');
    }

    const player = await this.playerRepository.findOne({ player_id });
    if (!player) {
      throw new NotFoundException(`Player with ID ${player_id} not found`);
    }

    player.name = name.trim();
    return (await this.playerRepository.save(player)) as PlayerType;
  }
}

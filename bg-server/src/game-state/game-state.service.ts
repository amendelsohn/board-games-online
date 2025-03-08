import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameState } from '../database/entities';
import { v4 as uuidv4 } from 'uuid';
import { PlayerId } from 'src/player/Player';
import GameStateType from './GameState';

@Injectable()
export class GameStateService {
  constructor(
    @InjectRepository(GameState)
    private gameStateRepository: Repository<GameState>,
  ) {}

  async getGameState(id: string): Promise<GameStateType> {
    const gameState = await this.gameStateRepository.findOne({ id });
    if (!gameState) {
      throw new NotFoundException(`Game state with ID ${id} not found`);
    }
    return (gameState as unknown) as GameStateType;
  }

  async createGameState(
    players: PlayerId[],
    gameType: string,
    initialState: any = {},
  ): Promise<string> {
    const currentPlayer = players[0]; // First player goes first

    const gameState = this.gameStateRepository.create({
      id: uuidv4(),
      current_player: currentPlayer,
      is_game_over: false,
      winning_players: [],
      losing_players: [],
      game_specific_state: {
        gameType,
        ...initialState,
      },
    });

    const savedState = await this.gameStateRepository.save(gameState);
    return savedState.id;
  }

  async updateGameState(
    id: string,
    updates: Partial<GameStateType> & { game_specific_state?: any },
  ): Promise<GameStateType> {
    const gameState = await this.gameStateRepository.findOne({ id });
    if (!gameState) {
      throw new NotFoundException(`Game state with ID ${id} not found`);
    }

    // Update properties
    if (updates.current_player) {
      gameState.current_player = updates.current_player;
    }

    if (updates.is_game_over !== undefined) {
      gameState.is_game_over = updates.is_game_over;
    }

    if (updates.winning_players) {
      gameState.winning_players = updates.winning_players;
    }

    if (updates.losing_players) {
      gameState.losing_players = updates.losing_players;
    }

    // Handle game-specific state separately
    if (updates.game_specific_state) {
      gameState.game_specific_state = {
        ...gameState.game_specific_state,
        ...updates.game_specific_state,
      };
    }

    return ((await this.gameStateRepository.save(
      gameState,
    )) as unknown) as GameStateType;
  }
}

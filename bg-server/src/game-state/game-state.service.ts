import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameState, Table } from '../database/entities';
import { v4 as uuidv4 } from 'uuid';
import { PlayerId } from 'src/player/Player';
import GameStateType from './GameState';

@Injectable()
export class GameStateService {
  constructor(
    @InjectRepository(GameState)
    private gameStateRepository: Repository<GameState>,
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
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

    // Find tables that use this game state and update them
    await this.syncGameStateToTables(savedState.id, savedState);

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

    const updatedState = await this.gameStateRepository.save(gameState);

    // Sync the updated game state to all tables that use it
    await this.syncGameStateToTables(id, updatedState);

    return (updatedState as unknown) as GameStateType;
  }

  // Helper method to sync game state to tables
  private async syncGameStateToTables(
    gameStateId: string,
    gameState: GameState,
  ): Promise<void> {
    // Find all tables that use this game state
    const tables = await this.tableRepository.find({
      game_state_id: gameStateId,
    });

    // Update each table with the current game state data
    for (const table of tables) {
      // Create a plain object from the game state entity
      // This ensures proper serialization to JSON in the database
      const gameStateData = {
        id: gameState.id,
        current_player: gameState.current_player,
        is_game_over: gameState.is_game_over,
        winning_players: gameState.winning_players,
        losing_players: gameState.losing_players,
        game_specific_state: gameState.game_specific_state,
      };

      table.game_state_data = gameStateData;
      await this.tableRepository.save(table);

      console.log(
        'Updated table game state data:',
        JSON.stringify(gameStateData),
      );
    }
  }

  // Get game state from table (for client polling)
  async getGameStateFromTable(tableId: string): Promise<GameStateType> {
    const table = await this.tableRepository.findOne({ table_id: tableId });
    if (!table) {
      throw new NotFoundException(`Table with ID ${tableId} not found`);
    }

    if (!table.game_state_data) {
      throw new NotFoundException(`No game state found for table ${tableId}`);
    }

    return (table.game_state_data as unknown) as GameStateType;
  }
}

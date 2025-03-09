import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameState, Table } from '../database/entities';
import { v4 as uuidv4 } from 'uuid';
import { PlayerId } from 'src/player/Player';
import GameStateType from './GameState';
import { GameRegistryService } from 'src/games/game-registry.service';
import { GameMove } from 'src/games/game-interface';

@Injectable()
export class GameStateService {
  constructor(
    @InjectRepository(GameState)
    private gameStateRepository: Repository<GameState>,
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
    private gameRegistry: GameRegistryService,
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
    // Get the game implementation
    const gameImpl = this.gameRegistry.getGame(gameType);
    if (!gameImpl) {
      throw new NotFoundException(`Game type '${gameType}' not found`);
    }

    // Validate player count
    const minPlayers = gameImpl.getMinPlayers();
    const maxPlayers = gameImpl.getMaxPlayers();

    if (players.length < minPlayers || players.length > maxPlayers) {
      throw new Error(
        `Game ${gameType} requires between ${minPlayers} and ${maxPlayers} players`,
      );
    }

    // Create game-specific initial state
    const gameSpecificState = gameImpl.createInitialState(players);
    const currentPlayer = players[0]; // First player goes first

    const gameState = this.gameStateRepository.create({
      id: uuidv4(),
      current_player: currentPlayer,
      is_game_over: false,
      winning_players: [],
      losing_players: [],
      game_specific_state: {
        gameType,
        ...gameSpecificState,
      },
    });

    const savedState = await this.gameStateRepository.save(gameState);

    // Find tables that use this game state and update them
    await this.syncGameStateToTables(savedState.id, savedState);

    return savedState.id;
  }

  async processMove(
    gameStateId: string,
    playerId: PlayerId,
    move: GameMove,
  ): Promise<GameStateType> {
    // Get current game state
    const gameState = await this.getGameState(gameStateId);

    // Get game implementation
    const gameType = gameState.game_specific_state.gameType;
    const gameImpl = this.gameRegistry.getGame(gameType);

    if (!gameImpl) {
      throw new NotFoundException(`Game type '${gameType}' not found`);
    }

    // Validate move
    if (!gameImpl.isValidMove(gameState, move, playerId)) {
      throw new Error('Invalid move');
    }

    // Apply move
    const updatedState = gameImpl.applyMove(gameState, move, playerId);

    // Save updated state
    return this.updateGameState(gameStateId, updatedState);
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

    // No need to duplicate game state data in the tables
    // We're only using a reference via game_state_id now
    // This method is kept for compatibility and could be expanded
    // in the future if needed for additional synchronization tasks
  }

  // Get game state from table (for client polling)
  async getGameStateFromTable(tableId: string): Promise<GameStateType> {
    const table = await this.tableRepository.findOne({ table_id: tableId });
    if (!table) {
      throw new NotFoundException(`Table with ID ${tableId} not found`);
    }

    if (!table.game_state_id) {
      throw new NotFoundException(`No game state found for table ${tableId}`);
    }

    // Get the game state using its ID
    return this.getGameState(table.game_state_id);
  }
}

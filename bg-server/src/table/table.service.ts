import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table as TableEntity } from '../database/entities';
import TableType, { TableStatus } from './Table';
import { v4 as uuidv4 } from 'uuid';
import { PlayerId } from 'src/player/Player';
import { GameStateService } from '../game-state/game-state.service';

@Injectable()
export class TableService {
  constructor(
    @InjectRepository(TableEntity)
    private tableRepository: Repository<TableEntity>,
    private gameStateService: GameStateService,
  ) {}

  // Get a table by ID
  async getTable(table_id: string): Promise<TableType> {
    const table = await this.getTableById(table_id);
    return (table as unknown) as TableType;
  }

  // Get a table by join code
  async getTableByJoinCode(join_code: string): Promise<TableType> {
    const table = await this.tableRepository.findOne({ join_code });
    if (!table) {
      throw new NotFoundException(
        `Table with join code ${join_code} not found`,
      );
    }
    return (table as unknown) as TableType;
  }

  // Create a new table with a random join code
  async createTable(
    gameType: string,
    hostPlayerId: PlayerId,
    initialGameState: any = {},
  ): Promise<TableType> {
    // Generate a random 4-letter join code
    const join_code = this.generateJoinCode();

    // Don't create game state immediately, wait until game starts with enough players
    const table = this.tableRepository.create({
      table_id: uuidv4(),
      join_code,
      player_ids: [hostPlayerId],
      host_player_id: hostPlayerId,
      status: TableStatus.WAITING,
      game_type: gameType,
      game_state_id: null, // Will be set when the game starts
    });

    return ((await this.tableRepository.save(table)) as unknown) as TableType;
  }

  // Add a player to a table if it's in WAITING status
  async joinTable(join_code: string, player_id: PlayerId): Promise<TableType> {
    const table = await this.tableRepository.findOne({ join_code });

    if (!table) {
      throw new NotFoundException(
        `Table with join code ${join_code} not found`,
      );
    }

    if (table.status !== TableStatus.WAITING) {
      throw new BadRequestException(
        `Table with join code ${join_code} is not in waiting state`,
      );
    }

    // Add player if not already in the table
    if (!table.player_ids.includes(player_id)) {
      table.player_ids.push(player_id);
      await this.tableRepository.save(table);
    }

    return (table as unknown) as TableType;
  }

  // Start a game if the requesting player is the host
  async startGame(table_id: string, player_id: PlayerId): Promise<TableType> {
    const table = await this.getTableById(table_id);

    if (table.host_player_id !== player_id) {
      throw new BadRequestException('Only the host can start the game');
    }

    if (table.status !== TableStatus.WAITING) {
      throw new BadRequestException('Game has already started or finished');
    }

    if (table.player_ids.length < 2) {
      throw new BadRequestException('Need at least 2 players to start a game');
    }

    // Create initial state based on game type
    let initialState = {};

    if (table.game_type === 'tic-tac-toe') {
      // Initialize with empty 3x3 board for Tic-Tac-Toe
      initialState = {
        board: [
          ['', '', ''],
          ['', '', ''],
          ['', '', ''],
        ],
      };
    }

    // Only create a game state if one doesn't exist yet
    if (!table.game_state_id) {
      // Create game state using our new service
      table.game_state_id = await this.gameStateService.createGameState(
        table.player_ids,
        table.game_type,
        initialState,
      );
    }

    // Update status to playing
    table.status = TableStatus.PLAYING;
    await this.tableRepository.save(table);

    return (table as unknown) as TableType;
  }

  // Add players to an existing table
  async addPlayers(table_id: string, player_ids: string[]): Promise<TableType> {
    const table = await this.getTableById(table_id);

    if (table.status !== TableStatus.WAITING) {
      throw new BadRequestException(
        'Cannot add players after game has started',
      );
    }

    // Add unique players
    table.player_ids = [...new Set([...table.player_ids, ...player_ids])];
    await this.tableRepository.save(table);

    return (table as unknown) as TableType;
  }

  // Generate a random 4-letter join code
  private generateJoinCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }
    return result;
  }

  // Helper method to get a table by ID
  private async getTableById(table_id: string): Promise<TableEntity> {
    const table = await this.tableRepository.findOne({ table_id });
    if (!table) {
      throw new NotFoundException(`Table with ID ${table_id} not found`);
    }
    return table;
  }
}

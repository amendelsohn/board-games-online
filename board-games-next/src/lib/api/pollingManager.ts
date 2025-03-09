import { GameState } from "@/types";
import { getGameState } from ".";

// Type for a polling operation
type PollingOperation = {
  tableId: string;
  stop: () => void;
};

// Singleton class to manage polling operations
class PollingManager {
  private static instance: PollingManager;
  private pollingOperations: Map<string, PollingOperation> = new Map();

  private constructor() {
    console.log("PollingManager: Initialized");
  }

  public static getInstance(): PollingManager {
    if (!PollingManager.instance) {
      PollingManager.instance = new PollingManager();
    }
    return PollingManager.instance;
  }

  /**
   * Start polling for a specific table
   * @param tableId The ID of the table to poll
   * @param onUpdate Callback function to handle updates
   * @param interval Polling interval in milliseconds
   * @param onError Callback function to handle errors
   * @returns A function to stop polling
   */
  public startPolling(
    tableId: string,
    onUpdate: (gameState: GameState) => void,
    interval: number = 2000,
    onError?: (error: Error) => void
  ): () => void {
    console.log(`PollingManager: Starting polling for table ${tableId}`);

    // Stop any existing polling for this table
    if (this.pollingOperations.has(tableId)) {
      console.log(
        `PollingManager: Found existing polling for table ${tableId}, stopping it first`
      );
      this.stopPolling(tableId);
    }

    let isPolling = true;
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      if (!isPolling) {
        console.log(`PollingManager: Polling stopped for table ${tableId}`);
        return;
      }

      try {
        console.log(`PollingManager: Fetching game state for table ${tableId}`);
        const gameState = await getGameState(tableId);
        console.log(
          `PollingManager: Received game state for table ${tableId}`,
          gameState
        );
        onUpdate(gameState);
      } catch (error) {
        console.error(
          `PollingManager: Error polling for table ${tableId}:`,
          error
        );
        if (onError && error instanceof Error) {
          onError(error);
        } else {
          console.error("PollingManager: Polling error:", error);
        }
      }

      if (isPolling) {
        console.log(
          `PollingManager: Scheduling next poll for table ${tableId} in ${interval}ms`
        );
        timeoutId = setTimeout(poll, interval);
      }
    };

    // Start polling
    console.log(`PollingManager: Executing first poll for table ${tableId}`);
    poll();

    // Create a stop function
    const stop = () => {
      console.log(`PollingManager: Stop function called for table ${tableId}`);
      isPolling = false;
      if (timeoutId) {
        console.log(`PollingManager: Clearing timeout for table ${tableId}`);
        clearTimeout(timeoutId);
      }
      this.pollingOperations.delete(tableId);
      console.log(
        `PollingManager: Removed polling operation for table ${tableId}`
      );
      console.log(
        `PollingManager: Active polling operations:`,
        Array.from(this.pollingOperations.keys())
      );
    };

    // Store the polling operation
    this.pollingOperations.set(tableId, {
      tableId,
      stop,
    });

    console.log(`PollingManager: Added polling operation for table ${tableId}`);
    console.log(
      `PollingManager: Active polling operations:`,
      Array.from(this.pollingOperations.keys())
    );

    return stop;
  }

  /**
   * Stop polling for a specific table
   * @param tableId The ID of the table to stop polling
   */
  public stopPolling(tableId: string): void {
    console.log(`PollingManager: Stopping polling for table ${tableId}`);
    const operation = this.pollingOperations.get(tableId);
    if (operation) {
      console.log(
        `PollingManager: Found polling operation for table ${tableId}, stopping it`
      );
      operation.stop();
    } else {
      console.log(
        `PollingManager: No polling operation found for table ${tableId}`
      );
    }
  }

  /**
   * Stop all active polling operations
   */
  public stopAllPolling(): void {
    console.log(`PollingManager: Stopping all polling operations`);
    this.pollingOperations.forEach((operation) => {
      console.log(
        `PollingManager: Stopping polling for table ${operation.tableId}`
      );
      operation.stop();
    });
    this.pollingOperations.clear();
    console.log(`PollingManager: All polling operations stopped`);
  }

  /**
   * Get all active polling operations
   * @returns An array of table IDs being polled
   */
  public getActivePolling(): string[] {
    return Array.from(this.pollingOperations.keys());
  }
}

// Create the singleton instance
const pollingManagerInstance = PollingManager.getInstance();

// Utility function to stop polling for a specific table
export const stopPollingForTable = (tableId: string): void => {
  console.log(`stopPollingForTable: Stopping polling for table ${tableId}`);
  pollingManagerInstance.stopPolling(tableId);
};

// Utility function to stop all polling
export const stopAllPolling = (): void => {
  console.log(`stopAllPolling: Stopping all polling`);
  pollingManagerInstance.stopAllPolling();
};

// Export the singleton instance
export const pollingManager = pollingManagerInstance;

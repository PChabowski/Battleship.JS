import {
  insertCoin,
  onPlayerJoin,
  myPlayer,
  isHost,
  setState,
  getState,
  getRoomCode,
  RPC,
  PlayerState,
} from 'playroomkit';
import { PlacedShip } from '../types';

export interface ShotSyncData {
  fromPlayerId: string;
  targetPlayerId: string;
  coord: string;
  isHit: boolean;
  isSunk: boolean;
  sunkShip?: {
    id: string;
    name: string;
    type: string;
    size: number;
    coordinates: string[];
  };
  bufferCoordinates?: string[];
  message: string;
  time: number;
}

export interface PlayroomGameState {
  roomCode: string;
  isHost: boolean;
  myId: string;
  myName: string;
  opponentId: string | null;
  opponentName: string | null;
  meReady: boolean;
  opponentReady: boolean;
  bothReady: boolean;
  gameStarted: boolean;
  currentTurnId: string | null;
  shots: ShotSyncData[];
  winnerId: string | null;
  opponentShips: PlacedShip[];
}

// Generate fallback 4-character room code (e.g. "K8B2")
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Resilient copy to clipboard supporting iframes
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) return true;
  } catch {
    // Ignore
  }

  return false;
}

export class PlayroomManager {
  private static instance: PlayroomManager;
  private isInitialized = false;
  private initializingPromise: Promise<boolean> | null = null;
  private rpcRegistered = false;
  private isHostClient = true;
  private hostId: string | null = null;
  private players: PlayerState[] = [];
  private listeners: ((state: PlayroomGameState) => void)[] = [];
  private pollInterval: number | null = null;
  private activeRoomCode: string = '';
  private broadcastChannel: BroadcastChannel | null = null;
  private lastStateFingerprint: string = '';

  // Local mirrors for opponent in case player object isn't instantly in players array
  private localOpponentId: string | null = null;
  private localOpponentName: string | null = null;
  private localOpponentReady: boolean = false;
  private localOpponentShips: PlacedShip[] = [];

  public static getInstance(): PlayroomManager {
    if (!PlayroomManager.instance) {
      PlayroomManager.instance = new PlayroomManager();
    }
    return PlayroomManager.instance;
  }

  // Set explicit host role from room creator vs joiner
  public setHostStatus(isHost: boolean) {
    this.isHostClient = isHost;
    const myId = this.getMyId();
    if (isHost) {
      this.hostId = myId;
      try {
        setState('hostId', myId, true);
      } catch {}
      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({
            type: 'SET_HOST',
            hostId: myId,
          });
        } catch {}
      }
    }
    this.notifyListeners(true);
  }

  // Initialize Playroom SDK session
  public async initialize(roomCode?: string): Promise<boolean> {
    const cleanCode = roomCode ? roomCode.trim().toUpperCase() : '';

    if (this.isInitialized && (!cleanCode || cleanCode === this.activeRoomCode)) {
      this.notifyListeners(true);
      return true;
    }

    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    this.activeRoomCode = cleanCode;

    this.initializingPromise = (async () => {
      // Setup BroadcastChannel bridge for instant tab-to-tab communication
      this.setupBroadcastChannel(cleanCode);

      try {
        await insertCoin({
          skipLobby: true,
          maxPlayersPerRoom: 2,
          gameId: 'battleship-pl-10x10',
          roomCode: cleanCode || undefined,
        }).catch(() => {});

        this.isInitialized = true;
        const assignedCode = getRoomCode();
        if (assignedCode) {
          this.activeRoomCode = assignedCode.toUpperCase();
          this.setupBroadcastChannel(this.activeRoomCode);
        }

        // Track joining players
        try {
          onPlayerJoin((player: PlayerState) => {
            if (!this.players.some((p) => p.id === player.id)) {
              this.players.push(player);
            }
            this.notifyListeners(true);

            player.onQuit(() => {
              this.players = this.players.filter((p) => p.id !== player.id);
              this.notifyListeners(true);
            });
          });
        } catch {}

        // Register RPCs only once
        this.setupRpcListeners();

        // Poller for smooth UI reactivity without spamming
        if (!this.pollInterval) {
          this.pollInterval = window.setInterval(() => {
            this.notifyListeners(false);
          }, 400);
        }

        return true;
      } catch {
        // Fallback for sandboxed or offline environments
        this.isInitialized = true;
        this.setupBroadcastChannel(cleanCode || 'LOCAL');

        if (!this.pollInterval) {
          this.pollInterval = window.setInterval(() => {
            this.notifyListeners(false);
          }, 400);
        }
        return false;
      } finally {
        this.initializingPromise = null;
        this.notifyListeners(true);
      }
    })();

    return this.initializingPromise;
  }

  private setupBroadcastChannel(code: string) {
    if (typeof BroadcastChannel === 'undefined') return;
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
    }
    try {
      this.broadcastChannel = new BroadcastChannel(`playroom_battleship_${code || 'DEFAULT'}`);
      this.broadcastChannel.onmessage = (event) => {
        const msg = event.data;
        if (!msg) return;

        if (msg.type === 'SET_HOST') {
          if (msg.hostId) {
            this.hostId = msg.hostId;
            try {
              setState('hostId', msg.hostId, true);
            } catch {}
            this.notifyListeners(true);
          }
        } else if (msg.type === 'PLAYER_READY') {
          if (msg.playerId !== this.getMyId()) {
            this.localOpponentId = msg.playerId;
            this.localOpponentName = msg.name || 'Drugi Gracz';
            this.localOpponentReady = true;
            if (msg.ships && Array.isArray(msg.ships) && msg.ships.length > 0) {
              this.localOpponentShips = msg.ships;
            }
            // If current player is also ready, start game
            const me = myPlayer();
            const meReady = me ? (me.getState('ready') === true) : false;
            if (meReady) {
              const hostId = this.isHost() ? this.getMyId() : msg.playerId;
              setState('hostId', hostId, true);
              setState('bothReady', true, true);
              setState('gameStarted', true, true);
              if (!getState('currentTurnId')) {
                setState('currentTurnId', hostId, true);
              }
            }
            this.notifyListeners(true);
          }
        } else if (msg.type === 'PLAYER_UNREADY') {
          if (msg.playerId !== this.getMyId()) {
            this.localOpponentReady = false;
            this.localOpponentShips = [];
            try {
              setState('bothReady', false, true);
              setState('gameStarted', false, true);
            } catch {}
            this.notifyListeners(true);
          }
        } else if (msg.type === 'LAUNCH_BATTLE') {
          try {
            setState('gameStarted', true, true);
            setState('bothReady', true, true);
            if (msg.hostId) {
              this.hostId = msg.hostId;
              setState('hostId', msg.hostId, true);
            }
            if (msg.currentTurnId) {
              setState('currentTurnId', msg.currentTurnId, true);
            }
          } catch {}
          this.notifyListeners(true);
        } else if (msg.type === 'SHOT_FIRED') {
          if (msg.shot) {
            try {
              const currentShots = (getState('shots') as ShotSyncData[]) || [];
              if (!currentShots.some((s) => s.coord === msg.shot.coord && s.fromPlayerId === msg.shot.fromPlayerId)) {
                setState('shots', [...currentShots, msg.shot], true);
              }
              if (msg.nextTurnId) {
                setState('currentTurnId', msg.nextTurnId, true);
              }
              if (msg.winnerId) {
                setState('winnerId', msg.winnerId, true);
              }
            } catch {}
            this.notifyListeners(true);
          }
        } else if (msg.type === 'RESET_GAME') {
          this.resetLocalState();
          this.notifyListeners(true);
        }
      };
    } catch {
      // Ignore broadcast channel errors in restricted environments
    }
  }

  private setupRpcListeners() {
    if (this.rpcRegistered) return;
    this.rpcRegistered = true;

    try {
      RPC.register('PLAYER_READY', async (data: { playerId: string; name: string; ships: PlacedShip[] }) => {
        try {
          if (data && data.playerId !== this.getMyId()) {
            this.localOpponentId = data.playerId;
            this.localOpponentName = data.name;
            this.localOpponentReady = true;
            if (data.ships && Array.isArray(data.ships)) {
              this.localOpponentShips = data.ships;
            }

            // If current player is also ready, start game
            const me = myPlayer();
            const meReady = me ? (me.getState('ready') === true) : false;
            if (meReady) {
              const hostId = this.isHost() ? this.getMyId() : data.playerId;
              setState('hostId', hostId, true);
              setState('bothReady', true, true);
              setState('gameStarted', true, true);
              if (!getState('currentTurnId')) {
                setState('currentTurnId', hostId, true);
              }
            }
            this.notifyListeners(true);
          }
        } catch {}
      });

      RPC.register('PLAYER_UNREADY', async (data: { playerId: string }) => {
        try {
          if (data && data.playerId !== this.getMyId()) {
            this.localOpponentReady = false;
            this.localOpponentShips = [];
            try {
              setState('bothReady', false, true);
              setState('gameStarted', false, true);
            } catch {}
            this.notifyListeners(true);
          }
        } catch {}
      });

      RPC.register('LAUNCH_BATTLE', async (data: { currentTurnId: string; hostId?: string }) => {
        try {
          setState('gameStarted', true, true);
          setState('bothReady', true, true);
          if (data?.hostId) {
            this.hostId = data.hostId;
            setState('hostId', data.hostId, true);
          }
          if (data?.currentTurnId) {
            setState('currentTurnId', data.currentTurnId, true);
          }
          this.notifyListeners(true);
        } catch {}
      });

      RPC.register('SHOT_RESULT', async (data: { shot: ShotSyncData; nextTurnId: string; winnerId?: string }) => {
        try {
          const currentShots = (getState('shots') as ShotSyncData[]) || [];
          if (data?.shot && !currentShots.some((s) => s.coord === data.shot.coord && s.fromPlayerId === data.shot.fromPlayerId)) {
            setState('shots', [...currentShots, data.shot], true);
          }
          if (data?.nextTurnId) {
            setState('currentTurnId', data.nextTurnId, true);
          }
          if (data?.winnerId) {
            setState('winnerId', data.winnerId, true);
          }
          this.notifyListeners(true);
        } catch {}
      });
    } catch {
      // Ignore RPC registration errors if not supported
    }
  }

  public getRoomCode(): string {
    try {
      const code = getRoomCode();
      if (code) return code.toUpperCase();
    } catch {}
    return this.activeRoomCode || '';
  }

  public getMyId(): string {
    try {
      const me = myPlayer();
      if (me?.id) return me.id;
    } catch {}
    // Stable browser-session ID fallback
    try {
      let id = sessionStorage.getItem('battleship_playroom_id');
      if (!id) {
        id = 'p_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('battleship_playroom_id', id);
      }
      return id;
    } catch {
      return 'player_1';
    }
  }

  public isHost(): boolean {
    try {
      const roomHostId = (getState('hostId') as string) || this.hostId;
      if (roomHostId) {
        return this.getMyId() === roomHostId;
      }
    } catch {}

    try {
      if (typeof isHost === 'function') {
        const sdkIsHost = isHost();
        if (typeof sdkIsHost === 'boolean') {
          return sdkIsHost;
        }
      }
    } catch {}

    return this.isHostClient;
  }

  // Submit player fleet and mark readiness
  public setReady(ready: boolean, ships: PlacedShip[], playerName: string) {
    const myId = this.getMyId();

    try {
      const me = myPlayer();
      if (me) {
        me.setState('name', playerName || 'Dowódca', true);
        me.setState('ready', ready, true);
        me.setState('ships', ships, true);
      }
    } catch {}

    // Broadcast ready event across Playroom RPC and local BroadcastChannel
    try {
      RPC.call('PLAYER_READY', { playerId: myId, name: playerName, ships }, RPC.Mode.ALL).catch(() => {});
    } catch {}

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'PLAYER_READY',
          playerId: myId,
          name: playerName,
          ships,
        });
      } catch {}
    }

    // Check if opponent is already ready
    const opp = this.getOpponent();
    const oppReady = (opp ? opp.getState('ready') === true : false) || this.localOpponentReady;

    if (ready && oppReady) {
      const roomHostId = (getState('hostId') as string) || this.hostId;
      const definitiveHostId = roomHostId || (this.isHost() ? myId : (opp?.id || this.localOpponentId || myId));
      try {
        setState('hostId', definitiveHostId, true);
        setState('bothReady', true, true);
        setState('gameStarted', true, true);
        setState('currentTurnId', definitiveHostId, true);
      } catch {}
    }

    this.notifyListeners(true);
  }

  // Cancel readiness when player returns to change ship placement
  public cancelReady(playerName: string) {
    const myId = this.getMyId();

    try {
      const me = myPlayer();
      if (me) {
        me.setState('name', playerName || 'Dowódca', true);
        me.setState('ready', false, true);
        me.setState('ships', [], true);
      }
      setState('bothReady', false, true);
      setState('gameStarted', false, true);
    } catch {}

    try {
      RPC.call('PLAYER_UNREADY', { playerId: myId, name: playerName }, RPC.Mode.ALL).catch(() => {});
    } catch {}

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'PLAYER_UNREADY',
          playerId: myId,
        });
      } catch {}
    }

    this.notifyListeners(true);
  }

  // Force or manual start battle
  public launchBattle() {
    const myId = this.getMyId();
    const opp = this.getOpponent();
    const oppId = opp?.id || this.localOpponentId || 'opponent';
    const roomHostId = (getState('hostId') as string) || this.hostId;
    const definitiveHostId = roomHostId || (this.isHost() ? myId : oppId);

    try {
      setState('hostId', definitiveHostId, true);
      setState('gameStarted', true, true);
      setState('bothReady', true, true);
      setState('currentTurnId', definitiveHostId, true);
    } catch {}

    try {
      RPC.call('LAUNCH_BATTLE', { currentTurnId: definitiveHostId, hostId: definitiveHostId }, RPC.Mode.ALL).catch(() => {});
    } catch {}

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'LAUNCH_BATTLE',
          currentTurnId: definitiveHostId,
          hostId: definitiveHostId,
        });
      } catch {}
    }

    this.notifyListeners(true);
  }

  // Submit shot fired by player
  public submitShot(shot: ShotSyncData, nextTurnId: string, winnerId?: string) {
    try {
      const currentShots = (getState('shots') as ShotSyncData[]) || [];
      const nextShots = [...currentShots, shot];
      setState('shots', nextShots, true);
      setState('currentTurnId', nextTurnId, true);
      if (winnerId) {
        setState('winnerId', winnerId, true);
      }
    } catch {}

    try {
      RPC.call('SHOT_RESULT', { shot, nextTurnId, winnerId }, RPC.Mode.ALL).catch(() => {});
    } catch {}

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'SHOT_FIRED',
          shot,
          nextTurnId,
          winnerId,
        });
      } catch {}
    }

    this.notifyListeners(true);
  }

  public setWinner(winnerPlayerId: string) {
    try {
      setState('winnerId', winnerPlayerId, true);
    } catch {}
    this.notifyListeners(true);
  }

  private resetLocalState() {
    this.localOpponentReady = false;
    this.localOpponentShips = [];
    try {
      setState('shots', [], true);
      setState('winnerId', null, true);
      setState('gameStarted', false, true);
      setState('bothReady', false, true);
      setState('currentTurnId', null, true);
      const me = myPlayer();
      if (me) {
        me.setState('ready', false, true);
      }
    } catch {}
  }

  public resetGame() {
    this.resetLocalState();

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'RESET_GAME' });
      } catch {}
    }

    this.notifyListeners(true);
  }

  public getOpponent(): PlayerState | null {
    try {
      const me = myPlayer();
      if (!me) return null;
      return this.players.find((p) => p && p.id !== me.id) || null;
    } catch {
      return null;
    }
  }

  // Subscribe to real-time Playroom state changes
  public subscribe(listener: (state: PlayroomGameState) => void): () => void {
    this.listeners.push(listener);
    try {
      listener(this.getSnapshot());
    } catch {}
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getSnapshot(): PlayroomGameState {
    let me: PlayerState | undefined;
    try {
      me = myPlayer();
    } catch {}

    const myId = this.getMyId();
    let myName = 'Dowódca 1';
    let meReady = false;
    try {
      if (me) {
        myName = (me.getState('name') as string) || 'Dowódca 1';
        meReady = (me.getState('ready') as boolean) || false;
      }
    } catch {}

    const opp = this.getOpponent();
    const opponentId = opp?.id || this.localOpponentId || null;
    let opponentName: string | null = this.localOpponentName || null;
    let opponentReady = this.localOpponentReady || false;
    let opponentShips: PlacedShip[] = this.localOpponentShips || [];

    try {
      if (opp) {
        const n = opp.getState('name') as string;
        if (n) opponentName = n;
        const r = opp.getState('ready') as boolean;
        if (r !== undefined) opponentReady = r || this.localOpponentReady;
        const s = opp.getState('ships') as PlacedShip[];
        if (s && Array.isArray(s) && s.length > 0) opponentShips = s;
      }
    } catch {}

    let bothReady = false;
    let gameStarted = false;
    let storedTurnId: string | null = null;
    let shots: ShotSyncData[] = [];
    let winnerId: string | null = null;
    let roomHostId: string | null = this.hostId;

    try {
      bothReady = (getState('bothReady') as boolean) || (meReady && opponentReady);
      gameStarted = (getState('gameStarted') as boolean) || false;
      storedTurnId = (getState('currentTurnId') as string) || null;
      shots = (getState('shots') as ShotSyncData[]) || [];
      winnerId = (getState('winnerId') as string) || null;
      const sh = (getState('hostId') as string) || null;
      if (sh) roomHostId = sh;
    } catch {}

    // Deterministic single turn holder:
    // 1. Stored active turn
    // 2. Otherwise authoritative room host ID
    // 3. If host client and not initialized, myId; if guest client, roomHostId or null (NEVER myId)
    let currentTurnId: string | null = null;
    if (storedTurnId) {
      currentTurnId = storedTurnId;
    } else if (roomHostId) {
      currentTurnId = roomHostId;
    } else if (this.isHost()) {
      currentTurnId = myId;
    } else {
      currentTurnId = opponentId || null;
    }

    const roomCode = this.getRoomCode();

    return {
      roomCode,
      isHost: this.isHost(),
      myId,
      myName,
      opponentId,
      opponentName,
      meReady,
      opponentReady,
      bothReady,
      gameStarted,
      currentTurnId,
      shots,
      winnerId,
      opponentShips,
    };
  }

  private notifyListeners(force: boolean = false) {
    if (this.listeners.length === 0) return;
    const snapshot = this.getSnapshot();

    // Fingerprint check to prevent unneeded re-renders and console churn
    const fingerprint = `${snapshot.gameStarted}_${snapshot.bothReady}_${snapshot.currentTurnId}_${snapshot.meReady}_${snapshot.opponentReady}_${snapshot.shots.length}_${snapshot.winnerId}_${snapshot.opponentId}_${snapshot.isHost}`;
    if (!force && fingerprint === this.lastStateFingerprint) {
      return;
    }
    this.lastStateFingerprint = fingerprint;

    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Silently swallow any listener execution issues without console spam
      }
    }
  }
}

export const playroom = PlayroomManager.getInstance();

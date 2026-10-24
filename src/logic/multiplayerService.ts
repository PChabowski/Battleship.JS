// Client-side Playroom helper re-exports
import { playroom, ShotSyncData, copyToClipboard, generateRoomCode } from './playroomSync';
import { PlacedShip } from '../types';

export { copyToClipboard, generateRoomCode };

export type ShotRecord = ShotSyncData;

export interface RoomParticipant {
  id: string;
  name: string;
  ready: boolean;
}

export interface NetworkRoomState {
  code: string;
  hostId: string;
  hostName: string;
  players: RoomParticipant[];
  bothReady: boolean;
  currentTurn: string;
  shots: ShotRecord[];
  winner: string | null;
}

export function getOrCreatePlayerId(): string {
  return playroom.getMyId();
}

class MultiplayerServiceShim {
  public getCurrentRoomCode(): string {
    return playroom.getRoomCode();
  }

  public async joinRoom(roomCode: string, _playerId: string, _playerName: string): Promise<NetworkRoomState | null> {
    await playroom.initialize(roomCode);
    const snap = playroom.getSnapshot();
    return {
      code: snap.roomCode,
      hostId: snap.myId,
      hostName: snap.myName,
      bothReady: snap.bothReady,
      currentTurn: snap.currentTurnId || snap.myId,
      shots: snap.shots,
      winner: snap.winnerId,
      players: [
        { id: snap.myId, name: snap.myName, ready: snap.meReady },
        ...(snap.opponentId ? [{ id: snap.opponentId, name: snap.opponentName || 'Gracz 2', ready: snap.opponentReady }] : []),
      ],
    };
  }

  public async markReady(_roomCode: string, _playerId: string, ships: PlacedShip[]) {
    const snap = playroom.getSnapshot();
    playroom.setReady(true, ships, snap.myName);
    return null;
  }

  public async submitShot(_roomCode: string, _playerId: string, _coord: string) {
    return null;
  }

  public subscribeToRoom(_roomCode: string, onUpdate: (state: NetworkRoomState) => void): () => void {
    return playroom.subscribe((snap) => {
      onUpdate({
        code: snap.roomCode,
        hostId: snap.isHost ? snap.myId : (snap.opponentId || 'host'),
        hostName: snap.isHost ? snap.myName : (snap.opponentName || 'Host'),
        bothReady: snap.bothReady,
        currentTurn: snap.currentTurnId || snap.myId,
        shots: snap.shots,
        winner: snap.winnerId,
        players: [
          { id: snap.myId, name: snap.myName, ready: snap.meReady },
          ...(snap.opponentId ? [{ id: snap.opponentId, name: snap.opponentName || 'Gracz 2', ready: snap.opponentReady }] : []),
        ],
      });
    });
  }
}

export const multiplayerService = new MultiplayerServiceShim();

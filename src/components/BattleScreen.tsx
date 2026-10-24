import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RadarGrid } from './RadarGrid';
import { PlacedShip, ShotResult, PlayerStats } from '../types';
import {
  parseUserInputCoordinate,
  processShot,
  TOTAL_SHIPS_COUNT,
  FLEET_BLUEPRINT,
} from '../logic/gameRules';
import { BotAI } from '../logic/botAI';
import { sounds } from '../logic/soundEffects';
import { playroom, ShotSyncData } from '../logic/playroomSync';
import { ArrowLeft, Target, Shield, Radio } from 'lucide-react';

interface BattleScreenProps {
  playerName: string;
  opponentName: string;
  isMultiplayer: boolean;
  roomCode?: string;
  playerId?: string;
  playerShips: PlacedShip[];
  opponentShips: PlacedShip[];
  onGameOver: (winner: 'player' | 'opponent', stats: PlayerStats) => void;
  onSurrender: () => void;
}

export const BattleScreen: React.FC<BattleScreenProps> = ({
  playerName,
  opponentName,
  isMultiplayer,
  roomCode,
  playerId: _propPlayerId,
  playerShips: initialPlayerShips,
  opponentShips: initialOpponentShips,
  onGameOver,
  onSurrender,
}) => {
  // Player's defense fleet
  const [playerFleet, setPlayerFleet] = useState<PlacedShip[]>(() =>
    JSON.parse(JSON.stringify(initialPlayerShips))
  );

  // Target enemy fleet (what we are shooting at)
  const [enemyFleet, setEnemyFleet] = useState<PlacedShip[]>(() =>
    JSON.parse(JSON.stringify(initialOpponentShips))
  );

  // Shots on enemy radar (made by us)
  const [playerShots, setPlayerShots] = useState<
    Record<string, 'hit' | 'miss' | 'sunk' | 'buffer'>
  >({});

  // Shots on our defense radar (made by opponent)
  const [enemyShots, setEnemyShots] = useState<
    Record<string, 'hit' | 'miss' | 'sunk' | 'buffer'>
  >({});

  // Stats
  const [stats, setStats] = useState<PlayerStats>({
    guesses: 0,
    hits: 0,
    misses: 0,
    shipsSunk: 0,
  });

  const playerFleetRef = useRef(playerFleet);
  playerFleetRef.current = playerFleet;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const enemyFleetRef = useRef(enemyFleet);
  enemyFleetRef.current = enemyFleet;

  // Initial turn: Host starts first in multiplayer; in singleplayer player starts
  const isHost = useMemo(() => {
    if (!isMultiplayer) return true;
    return playroom.isHost();
  }, [isMultiplayer]);

  const [currentTurn, setCurrentTurn] = useState<'player' | 'opponent'>(() => {
    if (!isMultiplayer) return 'player';
    const snap = playroom.getSnapshot();
    const myId = playroom.getMyId();
    if (snap.currentTurnId) {
      return snap.currentTurnId === myId ? 'player' : 'opponent';
    }
    return isHost ? 'player' : 'opponent';
  });

  const [message, setMessage] = useState<string>(() => {
    if (!isMultiplayer) {
      return 'Bitwa morska rozpoczęta! Twoja tura — wybierz cel na radarze wroga.';
    }
    const snap = playroom.getSnapshot();
    const myId = playroom.getMyId();
    const isMyTurn = snap.currentTurnId ? snap.currentTurnId === myId : isHost;
    return isMyTurn
      ? 'Bitwa morska rozpoczęta! Twoja tura — wybierz cel na radarze wroga.'
      : `Bitwa morska rozpoczęta! Tura przeciwnika (${opponentName}) — oczekiwanie na pierwszy strzał...`;
  });

  const [inputCoord, setInputCoord] = useState<string>('');
  const [lastShotCoord, setLastShotCoord] = useState<string | undefined>(undefined);

  const gameOverTriggeredRef = useRef<boolean>(false);
  const botAIRef = useRef<BotAI>(new BotAI());
  const inputRef = useRef<HTMLInputElement>(null);
  const clickDebounceRef = useRef<boolean>(false);
  const processedShotsCountRef = useRef<number>(0);

  // Sync player fleet if updated before battle
  useEffect(() => {
    if (initialPlayerShips && initialPlayerShips.length > 0) {
      setPlayerFleet(JSON.parse(JSON.stringify(initialPlayerShips)));
      playerFleetRef.current = JSON.parse(JSON.stringify(initialPlayerShips));
    }
  }, [initialPlayerShips]);

  // Update enemy fleet if arrived late or updated via Playroom sync
  useEffect(() => {
    if (isMultiplayer && initialOpponentShips.length > 0 && Object.keys(playerShots).length === 0) {
      setEnemyFleet(JSON.parse(JSON.stringify(initialOpponentShips)));
      enemyFleetRef.current = JSON.parse(JSON.stringify(initialOpponentShips));
    }
  }, [isMultiplayer, initialOpponentShips, playerShots]);

  // Sunk ship counts
  const enemySunkCount = useMemo(() => {
    return Array.isArray(enemyFleet) ? enemyFleet.filter((s) => s && s.isSunk).length : 0;
  }, [enemyFleet]);

  const playerSunkCount = useMemo(() => {
    return Array.isArray(playerFleet) ? playerFleet.filter((s) => s && s.isSunk).length : 0;
  }, [playerFleet]);

  // Handle incoming shot from opponent
  const handleIncomingOpponentShot = useCallback(
    (shot: ShotSyncData) => {
      if (!shot || !shot.coord) return;

      // Mark shot on player's defense grid
      setEnemyShots((prev) => {
        const next = { ...prev };
        if (shot.isSunk && shot.sunkShip && Array.isArray(shot.sunkShip.coordinates)) {
          for (const c of shot.sunkShip.coordinates) next[c] = 'sunk';
          if (shot.bufferCoordinates && Array.isArray(shot.bufferCoordinates)) {
            for (const bc of shot.bufferCoordinates) {
              if (!next[bc]) next[bc] = 'buffer';
            }
          }
        } else if (shot.isHit) {
          next[shot.coord] = 'hit';
        } else {
          next[shot.coord] = 'miss';
        }
        return next;
      });

      // Synchronously mark hit and compute sunk states on player's fleet
      let sunkCount = 0;
      const updatedFleet = playerFleetRef.current.map((ship) => {
        if (ship && ship.coordinates && ship.coordinates.includes(shot.coord)) {
          const hits = Array.from(new Set([...(ship.hits || []), shot.coord]));
          const isSunk = shot.isSunk || hits.length >= ship.size;
          if (isSunk) sunkCount++;
          return { ...ship, hits: isSunk ? [...ship.coordinates] : hits, isSunk };
        }
        if (ship?.isSunk) sunkCount++;
        return ship;
      });

      playerFleetRef.current = updatedFleet;
      setPlayerFleet(updatedFleet);

      // Sound & messaging
      if (shot.isSunk) {
        sounds.playSunk();
        setMessage(`Przeciwnik zatopił Twój ${shot.sunkShip?.name || 'okręt'}!`);
      } else if (shot.isHit) {
        sounds.playHit();
        setMessage(`Przeciwnik trafił w Twoje pole ${shot.coord}! Przeciwnik strzela dalej...`);
      } else {
        sounds.playMiss();
        setMessage(`Przeciwnik spudłował (${shot.coord}). Twoja tura — ognia!`);
        setCurrentTurn('player');
      }

      // Check defeat: all 10 ships destroyed
      const allSunk =
        sunkCount >= TOTAL_SHIPS_COUNT ||
        (updatedFleet.length > 0 && updatedFleet.every((s) => s.isSunk));

      if (allSunk && !gameOverTriggeredRef.current) {
        gameOverTriggeredRef.current = true;
        sounds.playSunk();
        setMessage('PORAŻKA! Twoja flota została zniszczona...');
        if (isMultiplayer) {
          const snap = playroom.getSnapshot();
          const oppId = snap.opponentId || 'opponent';
          playroom.setWinner(oppId);
        }
        setTimeout(() => {
          onGameOver('opponent', statsRef.current);
        }, 1200);
      }
    },
    [isMultiplayer, onGameOver]
  );

  // -------------------------------------------------------------
  // PURE PLAYROOM SDK MULTIPLAYER LISTENER (SINGLE SOURCE OF TRUTH)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isMultiplayer) return;

    const myId = playroom.getMyId();

    const unsub = playroom.subscribe((state) => {
      // 1. If opponent ships arrive from Playroom, save them
      if (state.opponentShips && Array.isArray(state.opponentShips) && state.opponentShips.length > 0) {
        setEnemyFleet((prev) => {
          if (prev.length === 0 || Object.keys(playerShots).length === 0) {
            enemyFleetRef.current = JSON.parse(JSON.stringify(state.opponentShips));
            return JSON.parse(JSON.stringify(state.opponentShips));
          }
          return prev;
        });
      }

      // 2. Authoritative turn from Playroom SDK
      if (state.currentTurnId) {
        const isMyTurn = state.currentTurnId === myId;
        setCurrentTurn((prev) => (prev !== (isMyTurn ? 'player' : 'opponent') ? (isMyTurn ? 'player' : 'opponent') : prev));
      }

      // 3. Process new incoming shots
      if (state.shots && Array.isArray(state.shots) && state.shots.length > processedShotsCountRef.current) {
        const startIdx = processedShotsCountRef.current;
        processedShotsCountRef.current = state.shots.length;
        for (let i = startIdx; i < state.shots.length; i++) {
          const shot: ShotSyncData = state.shots[i];
          if (shot && shot.fromPlayerId !== myId) {
            handleIncomingOpponentShot(shot);
          }
        }
      }

      // 4. Game Over synchronization: if winner is declared, both players get modal
      if (state.winnerId && !gameOverTriggeredRef.current) {
        gameOverTriggeredRef.current = true;
        const didIWin = state.winnerId === myId;
        if (didIWin) {
          sounds.playVictory();
          setMessage('ZWYCIĘSTWO! Zatopiłeś wszystkie okręty wroga!');
          setTimeout(() => {
            onGameOver('player', statsRef.current);
          }, 1200);
        } else {
          sounds.playSunk();
          setMessage('PORAŻKA! Twoja flota została zniszczona...');
          setTimeout(() => {
            onGameOver('opponent', statsRef.current);
          }, 1200);
        }
      }
    });

    return () => {
      unsub();
    };
  }, [isMultiplayer, playerShots, handleIncomingOpponentShot, onGameOver]);

  // -------------------------------------------------------------
  // SHOT EXECUTION (INSTANT RESPONSIVE ON 1ST CLICK)
  // -------------------------------------------------------------
  const executePlayerShot = useCallback(
    (targetCoord: string) => {
      // 1. Turn check
      if (currentTurn !== 'player') {
        sounds.playMiss();
        setMessage('Czekaj na swoją turę! Teraz ruch przeciwnika.');
        return;
      }

      // 2. Already shot check
      if (playerShots[targetCoord]) {
        sounds.playMiss();
        setMessage('Już wcześniej ostrzeliwałeś to pole! Wybierz inny cel.');
        return;
      }

      // 3. Debounce
      if (clickDebounceRef.current) return;
      clickDebounceRef.current = true;
      setTimeout(() => {
        clickDebounceRef.current = false;
      }, 150);

      sounds.playFire();
      setLastShotCoord(targetCoord);

      // 4. Process shot against enemy fleet
      const result: ShotResult = processShot(targetCoord, enemyFleet);

      // 5. Update local target shots immediately (0ms latency)
      setPlayerShots((prev) => {
        const next = { ...prev };
        if (result.isSunk && result.sunkShip) {
          for (const c of result.sunkShip.coordinates) next[c] = 'sunk';
          if (result.bufferCoordinates) {
            for (const bc of result.bufferCoordinates) {
              if (!next[bc]) next[bc] = 'buffer';
            }
          }
        } else if (result.isHit) {
          next[targetCoord] = 'hit';
        } else {
          next[targetCoord] = 'miss';
        }
        return next;
      });

      setEnemyFleet([...enemyFleet]);

      // Sound
      if (result.isSunk) sounds.playSunk();
      else if (result.isHit) sounds.playHit();
      else sounds.playMiss();

      // Stats
      const newStats: PlayerStats = {
        guesses: stats.guesses + 1,
        hits: result.isHit ? stats.hits + 1 : stats.hits,
        misses: !result.isHit ? stats.misses + 1 : stats.misses,
        shipsSunk: result.isSunk ? stats.shipsSunk + 1 : stats.shipsSunk,
      };
      setStats(newStats);

      // 6. Check win condition
      const allEnemySunk = enemyFleet.every((s) => s.isSunk);
      if (allEnemySunk && !gameOverTriggeredRef.current) {
        gameOverTriggeredRef.current = true;
        sounds.playVictory();
        setMessage('ZWYCIĘSTWO! Zatopiłeś wszystkie okręty wroga!');
        if (isMultiplayer) {
          const myId = playroom.getMyId();
          playroom.setWinner(myId);
        }
        setTimeout(() => {
          onGameOver('player', newStats);
        }, 1200);
        return;
      }

      // 7. Turn logic:
      // If HIT: Player keeps turn!
      // If MISS: Turn switches to opponent!
      if (!result.isHit) {
        setCurrentTurn('opponent');
        setMessage('Spudłowałeś! Tura przeciwnika — oczekiwanie na strzał...');
      } else {
        setMessage(result.isSunk ? `${result.message} Masz kolejny strzał!` : 'TRAFIONY! Masz kolejny strzał — celuj dalej!');
      }

      // 8. Sync shot to Playroom SDK
      if (isMultiplayer) {
        const myId = playroom.getMyId();
        const snap = playroom.getSnapshot();
        const oppId = snap.opponentId || 'opponent';
        const nextTurnId = result.isHit ? myId : oppId;

        playroom.submitShot(
          {
            fromPlayerId: myId,
            targetPlayerId: oppId,
            coord: targetCoord,
            isHit: result.isHit,
            isSunk: result.isSunk,
            sunkShip: result.sunkShip
              ? {
                  id: result.sunkShip.id,
                  name: result.sunkShip.name,
                  type: result.sunkShip.type,
                  size: result.sunkShip.size,
                  coordinates: result.sunkShip.coordinates,
                }
              : undefined,
            bufferCoordinates: result.bufferCoordinates,
            message: result.message,
            time: Date.now(),
          },
          nextTurnId
        );
      }
    },
    [
      currentTurn,
      playerShots,
      enemyFleet,
      stats,
      isMultiplayer,
      onGameOver,
    ]
  );

  // -------------------------------------------------------------
  // SINGLEPLAYER BOT TURN (HUNT & TARGET)
  // -------------------------------------------------------------
  useEffect(() => {
    if (isMultiplayer || currentTurn !== 'opponent') return;

    const timer = setTimeout(() => {
      const targetCoord = botAIRef.current.getNextShot();
      sounds.playFire();

      const result: ShotResult = processShot(targetCoord, playerFleet);
      botAIRef.current.registerShotResult(result);

      setEnemyShots((prev) => {
        const next = { ...prev };
        if (result.isSunk && result.sunkShip) {
          for (const c of result.sunkShip.coordinates) next[c] = 'sunk';
          if (result.bufferCoordinates) {
            for (const bc of result.bufferCoordinates) {
              if (!next[bc]) next[bc] = 'buffer';
            }
          }
        } else if (result.isHit) {
          next[targetCoord] = 'hit';
        } else {
          next[targetCoord] = 'miss';
        }
        return next;
      });

      setPlayerFleet([...playerFleet]);

      if (result.isSunk) {
        sounds.playSunk();
        setMessage(`Wróg zatopił Twój ${result.sunkShip?.name}!`);
      } else if (result.isHit) {
        sounds.playHit();
        setMessage(`Wróg trafił w pole ${targetCoord}!`);
      } else {
        sounds.playMiss();
        setMessage(`Wróg spudłował (${targetCoord}). Twoja tura — ognia!`);
      }

      const allPlayerSunk = playerFleet.every((s) => s.isSunk);
      if (allPlayerSunk && !gameOverTriggeredRef.current) {
        gameOverTriggeredRef.current = true;
        sounds.playSunk();
        setMessage('PORAŻKA! Twoja flota została zniszczona...');
        setTimeout(() => {
          onGameOver('opponent', stats);
        }, 1200);
        return;
      }

      // If bot missed -> return turn to player. If bot hit -> bot keeps shooting!
      if (!result.isHit) {
        setCurrentTurn('player');
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [isMultiplayer, currentTurn, playerFleet, stats, onGameOver]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { coord, error } = parseUserInputCoordinate(inputCoord);
    if (error) {
      sounds.playMiss();
      setMessage(error);
      return;
    }
    if (coord) {
      executePlayerShot(coord);
      setInputCoord('');
    }
  };

  const isMyTurn = currentTurn === 'player';

  return (
    <div className="battle-screen-view">
      {/* Top Status Bar */}
      <div className="battle-top-bar">
        <button type="button" className="text-button" onClick={onSurrender}>
          <ArrowLeft size={18} />
          <span>Poddaj bitwę</span>
        </button>

        <div className="turn-banner">
          <Radio size={18} className={isMyTurn ? 'icon-active' : ''} />
          <span className="turn-label">
            {isMyTurn ? (
              <strong className="text-turn-player">TWOJA TURA — WYBIERZ CEL!</strong>
            ) : (
              <span className="text-turn-enemy">
                TURA PRZECIWNIKA ({opponentName}) — OSTRZAŁ...
              </span>
            )}
          </span>
        </div>

        <div className="battle-stats-summary">
          <span>Trafienia: {stats.hits}</span>
          <span>Pudła: {stats.misses}</span>
          {roomCode && (
            <span>
              Pokój: <strong>{roomCode}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Main Radar Screen Layout */}
      <div className="radars-layout-grid">
        {/* Opponent Radar (Where player shoots) */}
        <div className="radar-column primary-target-radar">
          <RadarGrid
            id="enemyRadar"
            title={`Radar Celowniczy · ${opponentName} (${enemySunkCount}/${TOTAL_SHIPS_COUNT})`}
            subtitle="Kliknij wybrane pole na siatce, aby oddać strzał torpedowy"
            ships={isMultiplayer ? [] : enemyFleet}
            shots={playerShots}
            onCellClick={(coord) => executePlayerShot(coord)}
            showShips={false}
            disabled={!isMyTurn}
            highlightCoord={lastShotCoord}
          />

          {/* Coordinate text input form */}
          <div className="coordinate-fire-form-card">
            <form onSubmit={handleFormSubmit} className="fire-form">
              <label htmlFor="targetCoordinateInput" className="fire-label">
                <Target size={18} />
                <span>Współrzędne:</span>
              </label>
              <input
                id="targetCoordinateInput"
                ref={inputRef}
                type="text"
                placeholder="np. A1, J10"
                value={inputCoord}
                maxLength={4}
                onChange={(e) => setInputCoord(e.target.value)}
                disabled={!isMyTurn}
                autoComplete="off"
              />
              <button
                type="submit"
                className="fire-submit-btn"
                disabled={!isMyTurn}
              >
                Ognia!
              </button>
            </form>
          </div>
        </div>

        {/* Player Radar (Own fleet defense) */}
        <div className="radar-column secondary-defense-radar">
          <RadarGrid
            id="playerRadar"
            title={`Twoja Flota · ${playerName} (${playerSunkCount}/${TOTAL_SHIPS_COUNT})`}
            subtitle="Podgląd stanu własnych jednostek i ostrzału przeciwnika"
            ships={playerFleet}
            shots={enemyShots}
            showShips={true}
            disabled={true}
          />

          {/* Fleet Status Breakdown */}
          <div className="fleet-status-card">
            <h4 className="fleet-status-title">
              <Shield size={16} />
              <span>Raport strat wrogiej floty</span>
            </h4>
            <div className="fleet-casualty-list">
              {FLEET_BLUEPRINT.map((bp) => {
                const total = bp.count;
                const sunk = enemyFleet.filter(
                  (s) => s.type === bp.type && s.isSunk
                ).length;

                return (
                  <div key={bp.type} className="fleet-casualty-item">
                    <span className="casualty-name">
                      {bp.name} ({bp.size}m)
                    </span>
                    <span className="casualty-count">
                      Zatopione: <strong>{sunk} / {total}</strong>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Military Teletype Message Area */}
      <div className="battle-teletype-hud">
        <div className="teletype-indicator">KOMUNIKAT RADAROWY:</div>
        <div className="teletype-message" id="messageArea">
          {message}
        </div>
      </div>
    </div>
  );
};

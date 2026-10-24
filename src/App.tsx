import React, { useState, useEffect } from 'react';
import { MainMenu } from './components/MainMenu';
import { ShipPlacement } from './components/ShipPlacement';
import { BattleScreen } from './components/BattleScreen';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { GameOverModal } from './components/GameOverModal';
import { PlacedShip, MatchType, PlayerStats } from './types';
import { generateRandomFleet } from './logic/gameRules';
import { sounds } from './logic/soundEffects';
import { playroom, PlayroomGameState } from './logic/playroomSync';
import { getOrCreatePlayerId } from './logic/multiplayerService';
import { Radio, Swords, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';

type ScreenState =
  | 'menu'
  | 'placement'
  | 'waiting_for_opponent'
  | 'multiplayer_lobby'
  | 'battle';

export const App: React.FC = () => {
  const [screen, setScreen] = useState<ScreenState>('menu');
  const [matchType, setMatchType] = useState<MatchType>('singleplayer');
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return sessionStorage.getItem('battleship_player_name') || 'Kapitan';
    } catch {
      return 'Kapitan';
    }
  });
  const [playerId] = useState<string>(() => getOrCreatePlayerId());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [activeRoomCode, setActiveRoomCode] = useState<string>('');

  // Ship Fleets
  const [playerFleet, setPlayerFleet] = useState<PlacedShip[]>([]);
  const [opponentFleet, setOpponentFleet] = useState<PlacedShip[]>([]);
  const [opponentName, setOpponentName] = useState<string>('Komputer SI');

  // Playroom State snapshot
  const [playroomState, setPlayroomState] = useState<PlayroomGameState>(() =>
    playroom.getSnapshot()
  );

  // Game over state
  const [showGameOverModal, setShowGameOverModal] = useState<boolean>(false);
  const [gameWinner, setGameWinner] = useState<'player' | 'opponent'>('player');
  const [endGameStats, setEndGameStats] = useState<PlayerStats>({
    guesses: 0,
    hits: 0,
    misses: 0,
    shipsSunk: 0,
  });

  // Check URL on initial load if someone opened a room invite link (e.g. ?room=ABCD) or autojoin
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room') || params.get('r');
    const autoJoin = params.get('autojoin') === '1';
    if (roomParam) {
      const code = roomParam.toUpperCase();
      setActiveRoomCode(code);
      setMatchType('multiplayer');
      playroom.setHostStatus(false);
      playroom.initialize(code);
      if (autoJoin) {
        setScreen('placement');
      } else {
        setScreen('multiplayer_lobby');
      }
    }
  }, []);

  // Listen to Playroom SDK state changes
  useEffect(() => {
    const unsubscribe = playroom.subscribe((state) => {
      setPlayroomState(state);

      if (state.opponentName) {
        setOpponentName(state.opponentName);
      }

      if (state.opponentShips && Array.isArray(state.opponentShips) && state.opponentShips.length > 0) {
        setOpponentFleet(state.opponentShips);
      }

      // Automatically launch battle when both are ready or game is started
      if ((state.gameStarted || state.bothReady) && screen === 'waiting_for_opponent') {
        sounds.playVictory();
        if (state.opponentShips && state.opponentShips.length > 0) {
          setOpponentFleet(state.opponentShips);
        } else if (opponentFleet.length === 0) {
          setOpponentFleet(generateRandomFleet());
        }
        setScreen('battle');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [screen, opponentFleet.length]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.enabled = next;
  };

  // 1. Singleplayer Flow
  const handleStartSingleplayer = (name: string) => {
    const validName = name.trim() || 'Kapitan';
    setPlayerName(validName);
    try {
      sessionStorage.setItem('battleship_player_name', validName);
    } catch {}
    setMatchType('singleplayer');
    setOpponentName('Komputer SI');
    setScreen('placement');
  };

  // 2. Multiplayer Flow (Playroom SDK)
  const handleStartMultiplayer = (name: string) => {
    const validName = name.trim() || 'Kapitan';
    setPlayerName(validName);
    try {
      sessionStorage.setItem('battleship_player_name', validName);
    } catch {}
    setMatchType('multiplayer');
    setOpponentName('Drugi Gracz');
    playroom.setHostStatus(true);
    setScreen('multiplayer_lobby');
  };

  // 3. Lobby -> Placement
  const handleLobbyProceed = (roomCode: string, isHost: boolean) => {
    setActiveRoomCode(roomCode);
    playroom.setHostStatus(isHost);
    playroom.initialize(roomCode);
    setScreen('placement');
  };

  // 4. Return to placement from waiting room (cancels readiness and preserves fleet)
  const handleBackToPlacement = () => {
    sounds.playClick();
    if (matchType === 'multiplayer') {
      playroom.cancelReady(playerName);
    }
    setScreen('placement');
  };

  // 5. Placement confirmed -> Waiting or Start Battle
  const handleConfirmFleet = (fleet: PlacedShip[]) => {
    setPlayerFleet(fleet);

    if (matchType === 'singleplayer') {
      const enemyFleet = generateRandomFleet();
      setOpponentFleet(enemyFleet);
      setScreen('battle');
    } else {
      // Sync fleet in Playroom SDK
      playroom.setReady(true, fleet, playerName);

      const snap = playroom.getSnapshot();
      if (snap.bothReady || snap.gameStarted) {
        sounds.playVictory();
        if (snap.opponentShips && Array.isArray(snap.opponentShips) && snap.opponentShips.length > 0) {
          setOpponentFleet(snap.opponentShips);
        } else {
          setOpponentFleet(generateRandomFleet());
        }
        setScreen('battle');
      } else {
        setScreen('waiting_for_opponent');
      }
    }
  };

  // Explicit Launch Battle button on the waiting screen
  const handleManualStartBattle = () => {
    sounds.playVictory();
    playroom.launchBattle();

    const snap = playroom.getSnapshot();
    if (snap.opponentShips && Array.isArray(snap.opponentShips) && snap.opponentShips.length > 0) {
      setOpponentFleet(snap.opponentShips);
    } else if (opponentFleet.length === 0) {
      setOpponentFleet(generateRandomFleet());
    }
    setScreen('battle');
  };

  // 6. Game Over handler
  const handleGameOver = (winner: 'player' | 'opponent', stats: PlayerStats) => {
    setGameWinner(winner);
    setEndGameStats(stats);
    setShowGameOverModal(true);
  };

  // 7. Play Again
  const handlePlayAgain = () => {
    setShowGameOverModal(false);
    if (matchType === 'multiplayer') {
      playroom.cancelReady(playerName);
      playroom.resetGame();
    }
    setScreen('placement');
  };

  // 8. Return to Main Menu
  const handleReturnToMenu = () => {
    setShowGameOverModal(false);
    if (matchType === 'multiplayer') {
      playroom.cancelReady(playerName);
      playroom.resetGame();
    }
    setScreen('menu');
  };

  const opponentIsReady = playroomState.opponentReady;

  return (
    <div className="app-viewport">
      {screen === 'menu' && (
        <MainMenu
          onStartSingleplayer={handleStartSingleplayer}
          onStartMultiplayer={handleStartMultiplayer}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
        />
      )}

      {screen === 'multiplayer_lobby' && (
        <MultiplayerLobby
          playerName={playerName}
          playerId={playerId}
          onProceedToPlacement={handleLobbyProceed}
          onBackToMenu={handleReturnToMenu}
        />
      )}

      {screen === 'placement' && (
        <ShipPlacement
          playerName={playerName}
          initialShips={playerFleet}
          onConfirmFleet={handleConfirmFleet}
          onBackToMenu={handleReturnToMenu}
        />
      )}

      {/* Target of Focus Mode: div#root > div > div > div (.waiting-card) */}
      {screen === 'waiting_for_opponent' && (
        <div className="waiting-opponent-container">
          <div className="waiting-card">
            <Radio size={48} className="waiting-radio-icon animate-pulse" />
            <h2>Twoja flota jest w pełnej gotowości!</h2>
            <p className="waiting-desc">
              Synchronizacja Playroom SDK. Sprawdź status dowódców i rozpocznij bitwę morską:
            </p>

            <div className="waiting-room-tag">
              POKÓJ BITWY: <strong>{activeRoomCode || playroomState.roomCode || 'PLAYROOM'}</strong>
            </div>

            {/* Live Player Readiness Cards */}
            <div className="commanders-readiness-grid">
              <div className="commander-status-card ready-badge">
                <CheckCircle2 size={20} className="status-check-icon" />
                <div className="commander-info">
                  <span className="commander-name">{playerName} (Ty)</span>
                  <span className="commander-state-text text-ready">FLOTA GOTOWA DO BOJU</span>
                </div>
              </div>

              <div
                className={`commander-status-card ${
                  opponentIsReady ? 'ready-badge' : 'pending-badge'
                }`}
              >
                {opponentIsReady ? (
                  <CheckCircle2 size={20} className="status-check-icon" />
                ) : (
                  <Clock size={20} className="status-pending-icon" />
                )}
                <div className="commander-info">
                  <span className="commander-name">
                    {playroomState.opponentName || 'Drugi Gracz'}
                  </span>
                  <span
                    className={`commander-state-text ${
                      opponentIsReady ? 'text-ready' : 'text-pending'
                    }`}
                  >
                    {opponentIsReady ? 'FLOTA GOTOWA DO BOJU' : 'ROZSTAWIA STATKI...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Launch Button */}
            <div className="waiting-actions-cluster">
              <button
                type="button"
                className="action-btn start-battle-btn ready start-now-big-btn"
                onClick={handleManualStartBattle}
              >
                <Swords size={22} />
                <span>ROZPOCZNIJ BITWĘ MORSKĄ</span>
              </button>

              <button
                type="button"
                className="text-button back-to-placement-btn"
                onClick={handleBackToPlacement}
              >
                <ArrowLeft size={16} />
                <span>Zmień rozstawienie swoich okrętów</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'battle' && (
        <BattleScreen
          playerName={playerName}
          opponentName={opponentName}
          isMultiplayer={matchType === 'multiplayer'}
          roomCode={activeRoomCode}
          playerId={playerId}
          playerShips={playerFleet}
          opponentShips={opponentFleet}
          onGameOver={handleGameOver}
          onSurrender={handleReturnToMenu}
        />
      )}

      {showGameOverModal && (
        <GameOverModal
          winner={gameWinner}
          stats={endGameStats}
          onPlayAgain={handlePlayAgain}
          onReturnToMenu={handleReturnToMenu}
        />
      )}
    </div>
  );
};

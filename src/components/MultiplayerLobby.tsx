import React, { useState, useEffect } from 'react';
import { Users, Copy, Check, ArrowLeft, Play, Radio, Shield } from 'lucide-react';
import { playroom, PlayroomGameState, copyToClipboard, generateRoomCode } from '../logic/playroomSync';
import { sounds } from '../logic/soundEffects';

interface MultiplayerLobbyProps {
  playerName: string;
  playerId: string;
  onProceedToPlacement: (roomCode: string, isHost: boolean) => void;
  onBackToMenu: () => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  playerName,
  playerId: _playerId,
  onProceedToPlacement,
  onBackToMenu,
}) => {
  // Check if room code was passed in the URL (e.g. ?room=ABCD or ?r=ABCD)
  const urlParams = new URLSearchParams(window.location.search);
  const initialRoomFromUrl = (urlParams.get('room') || urlParams.get('r') || '').toUpperCase();

  const [roomCode, setRoomCode] = useState<string>(() => initialRoomFromUrl || generateRoomCode());
  const [inputCode, setInputCode] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [playroomState, setPlayroomState] = useState<PlayroomGameState>(() => playroom.getSnapshot());

  // Link for direct invite
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

  useEffect(() => {
    // If opened with room in URL, this client is guest
    if (initialRoomFromUrl) {
      playroom.setHostStatus(false);
    } else {
      playroom.setHostStatus(true);
    }

    // Initialize Playroom SDK for this room
    playroom.initialize(roomCode).then(() => {
      const activeCode = playroom.getRoomCode();
      if (activeCode && activeCode !== roomCode) {
        setRoomCode(activeCode);
      }
    });

    // Subscribe to live Playroom players
    const unsubscribe = playroom.subscribe((state) => {
      setPlayroomState(state);
    });

    return () => {
      unsubscribe();
    };
  }, [roomCode, initialRoomFromUrl]);

  const handleCopyLink = async () => {
    sounds.playClick();
    const ok = await copyToClipboard(inviteUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyCode = async () => {
    sounds.playClick();
    const ok = await copyToClipboard(roomCode);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = inputCode.trim().toUpperCase();
    if (!code) return;
    sounds.playClick();

    try {
      sessionStorage.setItem('battleship_player_name', playerName);
    } catch {}

    if (code === roomCode) {
      playroom.setHostStatus(false);
      onProceedToPlacement(code, false);
      return;
    }

    // Cleanly connect into the target room with autojoin flag to pair Playroom SDK
    const targetUrl = `${window.location.origin}${window.location.pathname}?room=${code}&autojoin=1`;
    window.location.href = targetUrl;
  };

  const handleStartPlacement = () => {
    sounds.playClick();
    try {
      sessionStorage.setItem('battleship_player_name', playerName);
    } catch {}
    const isRoomHost = !initialRoomFromUrl;
    playroom.setHostStatus(isRoomHost);
    onProceedToPlacement(roomCode, isRoomHost);
  };

  const connectedPlayersCount = playroomState.opponentId ? 2 : 1;

  return (
    <div className="multiplayer-lobby-container">
      {/* Header Bar */}
      <div className="lobby-header-bar">
        <button type="button" className="text-button" onClick={onBackToMenu}>
          <ArrowLeft size={18} />
          <span>Powrót do menu</span>
        </button>
        <span className="lobby-badge">Playroom SDK · Rozgrywka Sieciowa</span>
      </div>

      {/* Hero */}
      <div className="lobby-hero">
        <Users size={48} className="lobby-hero-icon" />
        <h2>Pokój Bitwy Morskiej</h2>
        <p className="lobby-subtitle">
          Zaproś drugiego gracza na pojedynek taktyczny. Kod pokoju jest już aktywny w Playroom SDK!
        </p>
      </div>

      <div className="lobby-grid">
        {/* Host Section */}
        <div className="lobby-card host-card">
          <div className="card-badge">Opcja 1: Twój pokój gry</div>
          <h3 className="card-title">Wyślij zaproszenie znajomemu</h3>
          <p className="card-desc">
            Przekaż znajomemu poniższy kod lub wyślij mu bezpośredni link do gry:
          </p>

          {/* Room Code Badge */}
          <div className="room-code-display">
            <span className="room-code-label">KOD POKOJU:</span>
            <span className="room-code-text">{roomCode}</span>
            <button
              type="button"
              className="copy-mini-btn"
              onClick={handleCopyCode}
              title="Kopiuj sam kod pokoju"
            >
              {copiedCode ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedCode ? 'Skopiowano!' : 'Kopiuj kod'}</span>
            </button>
          </div>

          {/* Copyable Link Input */}
          <div className="link-input-wrapper">
            <label className="link-label">Bezpośredni link do pokoju:</label>
            <div className="link-input-row">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="invite-link-input"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                className="action-btn copy-btn"
                onClick={handleCopyLink}
              >
                {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedLink ? 'Skopiowano!' : 'Kopiuj'}</span>
              </button>
            </div>
            {copiedLink && (
              <span className="copy-success-badge">
                ✓ Link został skopiowany do schowka! Wyślij go znajomemu.
              </span>
            )}
          </div>

          {/* Connected Players Status */}
          <div className="players-status-banner">
            <Radio size={16} className="status-radio-icon animate-pulse" />
            <span>
              Połączeni dowódcy w Playroom: <strong>{connectedPlayersCount} / 2</strong>
            </span>
            <span className="player-tag">
              <Shield size={12} /> {playerName} (Ty)
            </span>
            {playroomState.opponentName && (
              <span className="player-tag">
                <Shield size={12} /> {playroomState.opponentName}
              </span>
            )}
          </div>

          {/* Proceed to Ship Placement Button */}
          <div className="proceed-section">
            <button
              type="button"
              className="action-btn start-battle-btn ready"
              onClick={handleStartPlacement}
            >
              <Play size={18} />
              <span>Przejdź do rozstawiania floty</span>
            </button>
            <p className="proceed-tip">
              * Rozstaw swoje okręty. Gdy obaj gracze zatwierdzą flotę, Playroom SDK rozpocznie bitwę!
            </p>
          </div>
        </div>

        {/* Join Section */}
        <div className="lobby-card join-card">
          <div className="card-badge">Opcja 2: Dołącz do gry</div>
          <h3 className="card-title">Masz kod od znajomego?</h3>
          <p className="card-desc">
            Wpisz kod otrzymany od drugiego gracza i dołącz do jego pokoju:
          </p>

          <form onSubmit={handleJoinWithCode} className="join-form">
            <div className="input-group">
              <input
                type="text"
                className="join-code-input"
                placeholder="np. K8B2"
                maxLength={8}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              />
            </div>

            <button
              type="submit"
              className="action-btn primary-btn"
              disabled={!inputCode.trim()}
            >
              Dołącz i rozstaw flotę
            </button>
          </form>

          <div className="join-instructions-box">
            <h4>Jak zagrać we dwoje?</h4>
            <ol>
              <li>Gracz 1 kopiuje link lub kod i wysyła Graczowi 2.</li>
              <li>Obaj gracze rozstawiają swoje 10 okrętów (1x4, 2x3, 3x2, 4x1).</li>
              <li>Po zatwierdzeniu gotowości gra automatycznie przechodzi do bitwy w Playroom SDK!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

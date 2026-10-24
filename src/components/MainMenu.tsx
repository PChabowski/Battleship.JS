import React, { useState } from 'react';
import { Volume2, VolumeX, HelpCircle, Users, Bot, Anchor, Shield } from 'lucide-react';
import { sounds } from '../logic/soundEffects';

interface MainMenuProps {
  onStartSingleplayer: (playerName: string) => void;
  onStartMultiplayer: (playerName: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartSingleplayer,
  onStartMultiplayer,
  soundEnabled,
  onToggleSound,
}) => {
  const [playerName, setPlayerName] = useState<string>('Kapitan');
  const [showRules, setShowRules] = useState<boolean>(false);

  const handleStartSolo = () => {
    sounds.playClick();
    onStartSingleplayer(playerName.trim() || 'Kapitan');
  };

  const handleStartMulti = () => {
    sounds.playClick();
    onStartMultiplayer(playerName.trim() || 'Kapitan');
  };

  return (
    <div className="main-menu-container">
      {/* Sound toggle & Info button */}
      <div className="menu-top-bar">
        <button
          type="button"
          className="icon-button"
          onClick={() => {
            onToggleSound();
            sounds.playClick();
          }}
          title={soundEnabled ? 'Wycisz dźwięki' : 'Włącz dźwięki'}
          aria-label="Przełącz dźwięk"
        >
          {soundEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={() => {
            setShowRules(true);
            sounds.playClick();
          }}
          title="Zasady bitwy morskiej"
          aria-label="Pokaż zasady"
        >
          <HelpCircle size={22} />
        </button>
      </div>

      {/* Hero Title */}
      <div className="menu-hero">
        <div className="radar-sweep-icon">
          <Anchor size={48} className="hero-anchor-icon" />
        </div>
        <h1 className="menu-title">ZAGRAJ W OKRĘTY</h1>
        <p className="menu-subtitle">
          Taktyczna bitwa morska 10×10 · Flota 10 okrętów · Standard turniejowy
        </p>
      </div>

      {/* Player identity input */}
      <div className="player-input-card">
        <label htmlFor="playerNameInput" className="player-label">
          Kryptonim dowódcy:
        </label>
        <div className="input-group">
          <Shield size={20} className="input-icon" />
          <input
            id="playerNameInput"
            type="text"
            className="player-name-input"
            value={playerName}
            maxLength={18}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Twój pseudonim"
          />
        </div>
      </div>

      {/* Main Mode Selection Cards */}
      <div className="mode-cards-grid">
        <div className="mode-card" onClick={handleStartSolo}>
          <div className="mode-icon-wrapper">
            <Bot size={40} />
          </div>
          <h2 className="mode-title">Graj z komputerem</h2>
          <p className="mode-desc">
            Zmierz się z zaawansowaną sztuczną inteligencją radarową. Szybka rozgrywka natychmiast bez oczekiwania.
          </p>
          <button type="button" className="mode-btn primary-btn" onClick={handleStartSolo}>
            Rozpocznij misję solo
          </button>
        </div>

        <div className="mode-card" onClick={handleStartMulti}>
          <div className="mode-icon-wrapper">
            <Users size={40} />
          </div>
          <h2 className="mode-title">Przeciw znajomemu</h2>
          <p className="mode-desc">
            Pojedynek 1 na 1 przez Playroom SDK! Wygeneruj kod pokoju lub wyślij link zaproszeniowy znajomemu.
          </p>
          <button type="button" className="mode-btn multi-btn" onClick={handleStartMulti}>
            Rozpocznij online (Playroom)
          </button>
        </div>
      </div>

      {/* Rules Modal */}
      {showRules && (
        <div className="modal-backdrop" onClick={() => setShowRules(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-header">Regulamin Bitwy Morskiej (10×10)</h3>
            <div className="rules-body">
              <p>
                <strong>1. Skład floty (10 okrętów):</strong>
              </p>
              <ul>
                <li>1× Czteromasztowiec (4 kratki)</li>
                <li>2× Trójmasztowce (3 kratki)</li>
                <li>3× Dwumasztowce (2 kratki)</li>
                <li>4× Jednomasztowce (1 kratka)</li>
              </ul>
              <p>
                <strong>2. Zakaz stykania się:</strong>
              </p>
              <p>
                Okręty <em>nie mogą stykać się ze sobą ani burtami, ani rogami</em> (każdy statek posiada strefę ochronną 1 kratki dookoła).
              </p>
              <p>
                <strong>3. Przebieg bitwy:</strong>
              </p>
              <p>
                Gracze strzelają naprzemiennie. W przypadku celnego trafienia gracz zachowuje prawo do oddania kolejnego strzału!
              </p>
              <p>
                <strong>4. Po zatopieniu:</strong>
              </p>
              <p>
                Gdy okręt zostanie zniszczony, system automatycznie oznacza pola wokół niego jako puste, zgodnie z regułą bufora.
              </p>
            </div>
            <button
              type="button"
              className="close-modal-btn"
              onClick={() => {
                setShowRules(false);
                sounds.playClick();
              }}
            >
              Zrozumiałem, powrót do bazy
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

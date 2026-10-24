import React from 'react';
import { Trophy, Skull, RotateCcw, Home } from 'lucide-react';
import { PlayerStats } from '../types';
import { TOTAL_SHIPS_COUNT } from '../logic/gameRules';
import { sounds } from '../logic/soundEffects';

interface GameOverModalProps {
  winner: 'player' | 'opponent';
  stats: PlayerStats;
  onPlayAgain: () => void;
  onReturnToMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  winner,
  stats,
  onPlayAgain,
  onReturnToMenu,
}) => {
  const isVictory = winner === 'player';
  const accuracy = stats.guesses > 0 ? Math.round((stats.hits / stats.guesses) * 100) : 0;

  return (
    <div className="modal-backdrop">
      <div className="game-over-card">
        <div className={`game-over-icon-circle ${isVictory ? 'victory' : 'defeat'}`}>
          {isVictory ? <Trophy size={56} /> : <Skull size={56} />}
        </div>

        <h2 className={`game-over-title ${isVictory ? 'victory-title' : 'defeat-title'}`}>
          {isVictory ? 'ZWYCIĘSTWO!' : 'FLOTA ZNISZCZONA'}
        </h2>

        <p className="game-over-subtitle">
          {isVictory
            ? 'Doskonałe dowodzenie! Wszystkie okręty wroga spoczęły na dnie.'
            : 'Nieprzyjaciel przejął kontrolę nad sektorem morskim.'}
        </p>

        {/* Detailed Stats */}
        <div className="stats-breakdown-grid">
          <div className="stat-box">
            <span className="stat-label">Oddane strzały</span>
            <span className="stat-value">{stats.guesses}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Celność</span>
            <span className="stat-value">{accuracy}%</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Trafienia</span>
            <span className="stat-value">{stats.hits}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Zatopione</span>
            <span className="stat-value">{stats.shipsSunk} / {TOTAL_SHIPS_COUNT}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="game-over-actions">
          <button
            type="button"
            className="action-btn start-battle-btn ready"
            onClick={() => {
              sounds.playClick();
              onPlayAgain();
            }}
          >
            <RotateCcw size={18} />
            <span>Zagraj ponownie</span>
          </button>

          <button
            type="button"
            className="action-btn secondary-btn"
            onClick={() => {
              sounds.playClick();
              onReturnToMenu();
            }}
          >
            <Home size={18} />
            <span>Menu główne</span>
          </button>
        </div>
      </div>
    </div>
  );
};

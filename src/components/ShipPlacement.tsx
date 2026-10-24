import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RotateCw, Dices, Trash2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { RadarGrid } from './RadarGrid';
import {
  FLEET_BLUEPRINT,
  TOTAL_SHIPS_COUNT,
  coordToIndices,
  calculateShipCoordinates,
  canPlaceShip,
  generateRandomFleet,
} from '../logic/gameRules';
import { PlacedShip, Orientation, ShipBlueprint } from '../types';
import { sounds } from '../logic/soundEffects';

interface ShipPlacementProps {
  playerName: string;
  initialShips?: PlacedShip[];
  onConfirmFleet: (ships: PlacedShip[]) => void;
  onBackToMenu: () => void;
}

export const ShipPlacement: React.FC<ShipPlacementProps> = ({
  playerName,
  initialShips,
  onConfirmFleet,
  onBackToMenu,
}) => {
  const [ships, setShips] = useState<PlacedShip[]>(() =>
    initialShips && initialShips.length > 0
      ? JSON.parse(JSON.stringify(initialShips))
      : []
  );
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [selectedBlueprint, setSelectedBlueprint] = useState<ShipBlueprint | null>(() =>
    initialShips && initialShips.length === TOTAL_SHIPS_COUNT ? null : FLEET_BLUEPRINT[0]
  );
  const [hoverCoord, setHoverCoord] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>(() =>
    initialShips && initialShips.length === TOTAL_SHIPS_COUNT
      ? 'Flota rozstawiona! Możesz dostosować pozycje lub zatwierdzić flotę.'
      : 'Rozmieść swoją flotę na radarze. Kliknij pole, aby postawić okręt.'
  );

  // Compute remaining counts for each blueprint
  const blueprintCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bp of FLEET_BLUEPRINT) {
      counts.set(bp.type, bp.count);
    }
    for (const ship of ships) {
      const current = counts.get(ship.type) || 0;
      counts.set(ship.type, Math.max(0, current - 1));
    }
    return counts;
  }, [ships]);

  // If currently selected blueprint is exhausted, auto-select next available blueprint
  useEffect(() => {
    if (selectedBlueprint && (blueprintCounts.get(selectedBlueprint.type) || 0) <= 0) {
      const nextAvailable = FLEET_BLUEPRINT.find((bp) => (blueprintCounts.get(bp.type) || 0) > 0);
      setSelectedBlueprint(nextAvailable || null);
    }
  }, [blueprintCounts, selectedBlueprint]);

  // Keyboard shortcut: 'R' to rotate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        toggleOrientation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orientation]);

  const toggleOrientation = useCallback(() => {
    sounds.playClick();
    setOrientation((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
  }, []);

  // Calculate preview coordinates for hover
  const { previewCoords, previewValid, validationReason } = useMemo(() => {
    if (!hoverCoord || !selectedBlueprint) {
      return { previewCoords: [], previewValid: true, validationReason: '' };
    }

    const indices = coordToIndices(hoverCoord);
    if (!indices) {
      return { previewCoords: [], previewValid: false, validationReason: 'Poza planszą' };
    }

    const coords = calculateShipCoordinates(
      indices.row,
      indices.col,
      selectedBlueprint.size,
      orientation
    );

    if (!coords) {
      return {
        previewCoords: [hoverCoord],
        previewValid: false,
        validationReason: 'Okręt nie mieści się na planszy!',
      };
    }

    const check = canPlaceShip(coords, ships);
    return {
      previewCoords: coords,
      previewValid: check.valid,
      validationReason: check.reason || '',
    };
  }, [hoverCoord, selectedBlueprint, orientation, ships]);

  // Cell hover
  const handleCellHover = (coord: string) => {
    setHoverCoord(coord);
    if (validationReason) {
      setStatusMessage(validationReason);
    }
  };

  const handleMouseLeave = () => {
    setHoverCoord(null);
    if (ships.length === TOTAL_SHIPS_COUNT) {
      setStatusMessage('Flota gotowa do boju! Zatwierdź rozstawienie.');
    } else {
      setStatusMessage('Wybierz okręt i kliknij na planszy lub użyj losowania.');
    }
  };

  // Cell click: Place ship OR pick up existing ship
  const handleCellClick = (coord: string) => {
    // Check if player clicked an existing ship to remove/reposition it
    const existingShipIndex = ships.findIndex((s) => s.coordinates.includes(coord));
    if (existingShipIndex >= 0) {
      const shipToRemove = ships[existingShipIndex];
      setShips((prev) => prev.filter((_, i) => i !== existingShipIndex));
      const bp = FLEET_BLUEPRINT.find((b) => b.type === shipToRemove.type);
      if (bp) {
        setSelectedBlueprint(bp);
        setOrientation(shipToRemove.orientation);
      }
      sounds.playClick();
      setStatusMessage(`Podniesiono ${shipToRemove.name}. Możesz postawić go ponownie.`);
      return;
    }

    // Otherwise, place currently selected ship
    if (!selectedBlueprint) {
      setStatusMessage('Wszystkie okręty zostały już rozstawione!');
      return;
    }

    const remaining = blueprintCounts.get(selectedBlueprint.type) || 0;
    if (remaining <= 0) {
      setStatusMessage(`Rozstawiono już wszystkie okręty typu ${selectedBlueprint.name}!`);
      return;
    }

    if (!previewValid || previewCoords.length === 0) {
      sounds.playMiss();
      setStatusMessage(validationReason || 'Niedozwolona pozycja okrętu!');
      return;
    }

    // Place ship
    const newShip: PlacedShip = {
      id: `player_ship_${Date.now()}_${Math.random()}`,
      type: selectedBlueprint.type,
      name: selectedBlueprint.name,
      size: selectedBlueprint.size,
      orientation,
      coordinates: previewCoords,
      hits: [],
      isSunk: false,
    };

    sounds.playSonar();
    const updatedShips = [...ships, newShip];
    setShips(updatedShips);

    if (updatedShips.length === TOTAL_SHIPS_COUNT) {
      setStatusMessage('Wszystkie 10 okrętów rozstawione! Możesz ruszać do bitwy.');
    } else {
      setStatusMessage(`Postawiono ${selectedBlueprint.name}. Wybierz kolejny okręt.`);
    }
  };

  // Randomize all 10 ships
  const handleRandomize = () => {
    sounds.playSonar();
    const randomFleet = generateRandomFleet();
    setShips(randomFleet);
    setSelectedBlueprint(null);
    setStatusMessage('Flota rozstawiona losowo zgodnie z regulaminem! Gotowy do boju.');
  };

  // Clear board
  const handleClear = () => {
    sounds.playClick();
    setShips([]);
    setSelectedBlueprint(FLEET_BLUEPRINT[0]);
    setStatusMessage('Plansza wyczyszczona. Rozpocznij rozstawianie floty.');
  };

  // Ready to battle
  const handleReady = () => {
    if (ships.length !== TOTAL_SHIPS_COUNT) {
      sounds.playMiss();
      setStatusMessage(`Musisz rozstawić wszystkie 10 okrętów! (Obecnie: ${ships.length}/10)`);
      return;
    }
    sounds.playVictory();
    onConfirmFleet(ships);
  };

  const isFleetComplete = ships.length === TOTAL_SHIPS_COUNT;

  return (
    <div className="ship-placement-view">
      {/* Top Bar Navigation */}
      <div className="placement-header-bar">
        <button type="button" className="text-button" onClick={onBackToMenu}>
          <ArrowLeft size={18} />
          <span>Menu główne</span>
        </button>
        <span className="commander-tag">Dowódca: <strong>{playerName}</strong></span>
      </div>

      <div className="placement-hero-title">
        <h2>Centrum Planowania Floty</h2>
        <p className="placement-instructions">{statusMessage}</p>
      </div>

      <div className="placement-layout">
        {/* Radar Board Area */}
        <div className="placement-board-card">
          <RadarGrid
            title="Radar Taktyczny Floty"
            subtitle="Kliknij lewym przyciskiem myszy, aby postawić lub podnieść okręt"
            ships={ships}
            previewCoords={previewCoords}
            previewValid={previewValid}
            onCellClick={handleCellClick}
            onCellHover={handleCellHover}
            onMouseLeave={handleMouseLeave}
            showShips={true}
          />
        </div>

        {/* Sidebar Controls & Available Ships */}
        <div className="placement-controls-panel">
          <div className="panel-section">
            <h3 className="section-title">Orientacja kadłuba</h3>
            <div className="orientation-controls">
              <button
                type="button"
                className={`orientation-btn ${orientation === 'horizontal' ? 'active' : ''}`}
                onClick={() => {
                  sounds.playClick();
                  setOrientation('horizontal');
                }}
              >
                Poziomo
              </button>
              <button
                type="button"
                className={`orientation-btn ${orientation === 'vertical' ? 'active' : ''}`}
                onClick={() => {
                  sounds.playClick();
                  setOrientation('vertical');
                }}
              >
                Pionowo
              </button>
              <button
                type="button"
                className="rotate-quick-btn"
                onClick={toggleOrientation}
                title="Obróć (Klawisz R)"
              >
                <RotateCw size={18} />
                <span>Obróć [R]</span>
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h3 className="section-title">
              Dostępne okręty ({ships.length}/{TOTAL_SHIPS_COUNT})
            </h3>
            <div className="ships-selector-list">
              {FLEET_BLUEPRINT.map((bp) => {
                const remaining = blueprintCounts.get(bp.type) || 0;
                const isSelected = selectedBlueprint?.type === bp.type;
                const isExhausted = remaining === 0;

                return (
                  <button
                    key={bp.type}
                    type="button"
                    className={`ship-choice-card ${isSelected ? 'selected' : ''} ${
                      isExhausted ? 'exhausted' : ''
                    }`}
                    onClick={() => {
                      sounds.playClick();
                      setSelectedBlueprint(bp);
                    }}
                    disabled={isExhausted}
                  >
                    <div className="ship-choice-header">
                      <span className="ship-name">{bp.name}</span>
                      <span className="ship-count-tag">
                        {bp.count - remaining} / {bp.count}
                      </span>
                    </div>
                    {/* Visual ship deck segments */}
                    <div className="ship-visual-preview">
                      {Array.from({ length: bp.size }, (_, i) => (
                        <div key={i} className="ship-cell-segment" />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="panel-action-buttons">
            <button
              type="button"
              className="action-btn secondary-btn"
              onClick={handleRandomize}
            >
              <Dices size={18} />
              <span>Rozmieść losowo</span>
            </button>
            <button
              type="button"
              className="action-btn secondary-btn danger-hover"
              onClick={handleClear}
              disabled={ships.length === 0}
            >
              <Trash2 size={18} />
              <span>Wyczyść planszę</span>
            </button>
          </div>

          <button
            type="button"
            className={`action-btn start-battle-btn ${isFleetComplete ? 'ready' : 'not-ready'}`}
            onClick={handleReady}
            disabled={!isFleetComplete}
          >
            <CheckCircle2 size={20} />
            <span>
              {isFleetComplete ? 'Zatwierdź flotę i rozpocznij bitwę' : `Rozmieść jeszcze ${TOTAL_SHIPS_COUNT - ships.length} okrętów`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { ROWS, COLS, indicesToCoord } from '../logic/gameRules';
import { PlacedShip } from '../types';

interface RadarGridProps {
  id?: string;
  title: string;
  subtitle?: string;
  ships?: PlacedShip[];
  shots?: Record<string, 'hit' | 'miss' | 'sunk' | 'buffer'>;
  previewCoords?: string[];
  previewValid?: boolean;
  onCellClick?: (coord: string) => void;
  onCellHover?: (coord: string) => void;
  onMouseLeave?: () => void;
  showShips?: boolean;
  disabled?: boolean;
  highlightCoord?: string;
  className?: string;
}

export const RadarGrid: React.FC<RadarGridProps> = ({
  id,
  title,
  subtitle,
  ships = [],
  shots = {},
  previewCoords = [],
  previewValid = true,
  onCellClick,
  onCellHover,
  onMouseLeave,
  showShips = false,
  disabled = false,
  highlightCoord,
  className = '',
}) => {
  // Build lookup of ship coordinates
  const shipCoordMap = React.useMemo(() => {
    const map = new Map<string, { ship: PlacedShip; isSunk: boolean }>();
    if (!ships || !Array.isArray(ships)) return map;
    if (!showShips && !ships.some((s) => s?.isSunk)) return map;

    for (const ship of ships) {
      if (!ship || !Array.isArray(ship.coordinates)) continue;
      for (const coord of ship.coordinates) {
        if (showShips || ship.isSunk) {
          map.set(coord, { ship, isSunk: !!ship.isSunk });
        }
      }
    }
    return map;
  }, [ships, showShips]);

  const previewSet = React.useMemo(() => new Set(previewCoords), [previewCoords]);

  return (
    <div className={`radar-container ${className}`} id={id}>
      <div className="radar-header">
        <h3 className="radar-title">{title}</h3>
        {subtitle && <span className="radar-subtitle">{subtitle}</span>}
      </div>

      <div className="grid-table-wrapper" onMouseLeave={onMouseLeave}>
        <table className="radar-table">
          <thead>
            <tr>
              <th className="corner-cell"></th>
              {COLS.map((col) => (
                <th key={col} className="col-header">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((rowLetter, rowIdx) => (
              <tr key={rowLetter}>
                <th className="row-header">{rowLetter}</th>
                {COLS.map((_, colIdx) => {
                  const coord = indicesToCoord(rowIdx, colIdx);
                  const shotStatus = shots[coord];
                  const shipInfo = shipCoordMap.get(coord);
                  const isPreview = previewSet.has(coord);
                  const isHighlighted = highlightCoord === coord;

                  // Determine classes
                  let cellClasses = 'radar-cell';

                  if (isPreview) {
                    cellClasses += previewValid ? ' preview-valid' : ' preview-invalid';
                  }

                  if (shotStatus === 'hit') {
                    cellClasses += ' hit';
                  } else if (shotStatus === 'sunk') {
                    cellClasses += ' sunk';
                  } else if (shotStatus === 'miss') {
                    cellClasses += ' miss';
                  } else if (shotStatus === 'buffer') {
                    cellClasses += ' buffer-miss';
                  } else if (shipInfo) {
                    cellClasses += ' has-ship';
                  }

                  if (isHighlighted) {
                    cellClasses += ' last-shot-highlight';
                  }

                  if (disabled) {
                    cellClasses += ' cell-disabled';
                  }

                  return (
                    <td
                      key={coord}
                      id={coord}
                      className={cellClasses}
                      onClick={() => !disabled && onCellClick && onCellClick(coord)}
                      onMouseEnter={() => !disabled && onCellHover && onCellHover(coord)}
                      title={`${coord}${shipInfo ? ` (${shipInfo.ship.name})` : ''}`}
                    >
                      {/* Inner decoration / visual icons */}
                      {shotStatus === 'hit' && <span className="cell-marker hit-mark">✕</span>}
                      {shotStatus === 'sunk' && <span className="cell-marker sunk-mark">☠</span>}
                      {shotStatus === 'miss' && <span className="cell-marker miss-mark">·</span>}
                      {shotStatus === 'buffer' && <span className="cell-marker buffer-mark">·</span>}
                      {shipInfo && !shotStatus && showShips && (
                        <div className="ship-deck-segment" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

# Battleship.JS — Okręty 10×10 (React + TypeScript)

Nowoczesna, pełnowymiarowa wersja klasycznej gry w okręty (Battleship) w standardzie turniejowym 10×10, z pełną flotą, kreatorem rozstawiania statków, trybem dla jednego gracza (inteligentne SI) oraz trybem wieloosobowym opartym o **Playroom SDK**.

## Nowa struktura projektu
- `src/assets/`: pliki graficzne (`board.png`, `ship.png`, `miss.png`).
- `src/components/`:
  - `MainMenu.tsx`: menu główne z wyborem trybu gry i regulaminem.
  - `ShipPlacement.tsx`: kreator rozstawiania własnej floty (poziom/pion, podgląd kolizji, autolosowanie).
  - `RadarGrid.tsx`: uniwersalna plansza radarowa 10×10 (A–J, 1–10).
  - `BattleScreen.tsx`: główny widok bitwy z dwiema planszami i systemem ostrzału.
  - `MultiplayerLobby.tsx`: pokój gry wieloosobowej z kodem zaproszeniowym (Playroom SDK).
  - `GameOverModal.tsx`: podsumowanie bitwy ze szczegółowymi statystykami.
- `src/logic/`:
  - `gameRules.ts`: zasady turniejowe, flota 10 okrętów, zakaz stykania rogami/burtami.
  - `botAI.ts`: algorytm sztucznej inteligencji typu *Hunt & Target*.
  - `soundEffects.ts`: syntezator dźwięków wojskowych i radaru (Web Audio API).
  - `playroomSync.ts`: adapter integracji z Playroom SDK.

## Główne funkcje
1. **Pełna plansza 10×10**:
   - Współrzędne A–J oraz 1–10.
   - 10 okrętów (łączna suma 20 masztów):
     - 1× Czteromasztowiec (4)
     - 2× Trójmasztowce (3)
     - 3× Dwumasztowce (2)
     - 4× Jednomasztowce (1)
2. **Kreator rozstawiania floty**:
   - Obrót pionowy i poziomy (przycisk lub klawisz `R`).
   - Podgląd na żywo z walidacją: okręty **nie mogą stykać się nawet rogami** (strefa buforowa 1 kratki).
   - Przycisk szybkiego losowego rozstawienia floty oraz czyszczenia planszy.
   - Możliwość podniesienia i przestawienia wcześniej postawionego okrętu.
3. **Menu główne**:
   - **Graj z komputerem**: walka z botem symulującym przemyślane poszukiwanie i dobijanie uszkodzonych okrętów.
   - **Przeciw znajomemu**: rozgrywka online przez Playroom SDK z możliwością skopiowania kodu pokoju i linku.
4. **Faza bitwy**:
   - Podwójny radar: celownik wroga (do strzałów) oraz podgląd własnej floty.
   - Strzelanie kliknięciem w pole lub wpisaniem koordynatów w konsoli (np. `B4`).
   - Po zatopieniu okrętu strefa buforowa wokół niego zostaje automatycznie oznaczona.
   - Efekty dźwiękowe (strzał, trafienie, pudło, zatopienie, sonar, fanfary).

## Uruchomienie
```bash
npm install
npm run dev
```
Aplikacja działa na porcie 3000 (`http://localhost:3000`).

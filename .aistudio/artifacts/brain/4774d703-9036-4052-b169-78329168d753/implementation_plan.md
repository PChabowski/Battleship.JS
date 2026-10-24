# Rozbudowa Battleship: Plansza 10x10, Kompletna Flota, Tryb Wieloosobowy Playroom SDK i Nowe Menu

Kompleksowa transformacja gry w okręty do standardu turniejowego 10x10 z pełną flotą (1x4, 2x3, 3x2, 4x1), fazą ręcznego i automatycznego rozstawiania własnych okrętów, nowym menu głównym (Graj z komputerem / Graj ze znajomym) oraz obsługą rozgrywki online dla dwóch graczy opartej o Playroom SDK.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Kluczowe decyzje ustalone z użytkownikiem w fazie pytań i ich konsekwencje architektoniczne:

- **Skład floty**: Klasyczny polski zestaw 10 okrętów o łącznej liczbie 20 masztów:
  - 1x 4-masztowiec (Czteromasztowiec)
  - 2x 3-masztowce (Trójmasztowce)
  - 3x 2-masztowce (Dwumasztowce)
  - 4x 1-masztowce (Jednomasztowce)
- **Zasady stykania się okrętów**: Zgodnie z oficjalnymi zasadami okręty **nie mogą stykać się ze sobą ani burtami, ani rogami** (strefa buforowa 1 kratki wokół każdego okrętu).
- **Rozstawianie okrętów gracza**:
  - Interaktywny tryb rozstawiania przed bitwą z przełącznikiem orientacji (Pionowo / Poziomo), wizualnym podglądem (hover zielony gdy poprawne, czerwony gdy kolizja/styk).
  - Przycisk szybkiego losowania („Rozmieść losowo”) oraz przycisk resetu („Wyczyść planszę”).
- **Restrukturyzacja katalogów**: Utworzenie `src/assets` (przeniesienie `board.png`, `ship.png`, `miss.png`) oraz `src/components` (podział na modułowe komponenty: `MainMenu`, `ShipPlacement`, `GameBoard`, `GameHud`, `MultiplayerLobby`).

---

### 1. Overview & Core Concept

- **Czym jest gra**: Pełnowymiarowa taktyczna bitwa morska w klimacie retro radaru nawigacyjnego, oferująca potyczki z inteligentnym botem lub rywalizację online ze znajomym w czasie rzeczywistym przez link lub kod pokoju.
- **Grupa docelowa**: Fani klasycznych gier planszowych i okrętów, szukający szybkiej, estetycznej rozgrywki jednoosobowej lub wieloosobowej bez instalacji zbędnych programów.
- **Wartość użytkowa**: Przejście z miniaturowej planszy Head First 7x7 do pełnowymiarowej gry 10x10, z zachowaniem retro klimatu, wygodną fazą planowania floty i płynnym multiplayerem.

---

### 2. User Experience & Visual Design

#### Kluczowe ścieżki użytkownika (User Flows)
1. **Menu Główne (`MainMenu`)**:
   - Tytuł radarowy *Zagraj w okręty / Battleship*.
   - Karta wyboru: **Graj z komputerem** (błyskawiczny start) oraz **Graj ze znajomym (Online Playroom)**.
   - Opcjonalne wprowadzenie pseudonimu gracza.
2. **Faza Rozstawiania Floty (`ShipPlacement`)**:
   - Dostępna zarówno w trybie jednoosobowym, jak i wieloosobowym.
   - Lista dostępnych okrętów do umieszczenia z dynamicznym licznikiem (np. `Czteromasztowiec (1/1)`).
   - Przycisk `Obróć [R]` (Poziomo / Pionowo).
   - Najechanie na planszę podświetla sylwetkę statku (zielony obrys = dozwolone, czerwony = niedozwolone stykanie lub wyjście poza planszę).
   - Przycisk „Rozmieść losowo” umożliwia natychmiastowe poprawne rozmieszczenie całej floty jednym kliknięciem.
   - Przycisk „Gotowy do bitwy” staje się aktywny dopiero po rozstawieniu wszystkich 10 okrętów.
3. **Faza Bitwy (`BattleView`)**:
   - Dwa radary: **Plansza Przeciwnika** (do oddawania strzałów) oraz **Twoja Flota** (podgląd własnych okrętów i strzałów wroga).
   - Status tury: „Twoja tura — wybierz cel!” lub „Tura przeciwnika — oczekiwanie na strzał...”.
   - Po trafieniu gracz zachowuje prawo do kolejnego strzału (klasyczna reguła) lub standardowa naprzemienność.
   - Wizualizacja zatopienia: po zniszczeniu wszystkich masztów danego statku, pola wokół niego automatycznie oznaczane są jako pudła (nie ma tam innych statków zgodnie z regułą bufora).
4. **Ekran Końcowy (`GameOverModal`)**:
   - Podsumowanie zwycięzcy, statystyki trafień, liczba oddanych strzałów oraz przycisk „Zagraj ponownie”.

#### Identyfikacja wizualna
- **Styl**: Retro terminal taktyczny / radar wojskowy (monochromatyczna czerń, fosforyzująca zieleń `#53AF13`, zieleń akcentowa `#98CF71`, ostrzegawcza czerwień `#EF4444` przy kolizjach).
- **Plansza 10x10**: Dynamicznie generowana responsywna siatka z koordynatami A–J oraz 1–10 (lub 0–9), zoptymalizowana pod kątem czytelności i klikania myszką/dotykiem.
- **Dźwięki (Web Audio API)**: Subtelne syntezowane efekty dźwiękowe radaru, strzału, trafienia, pudła i zatopienia (bez zewnętrznych plików audio).

---

### 3. Key Product Decisions & Trade-Offs

- **Biblioteka Multiplayer — Playroom SDK (`playroomkit`)**:
  - *Wybrany wariant*: `insertCoin({ skipLobby: true, maxPlayersPerRoom: 2 })` z dedykowanym customowym UI w klimacie gry lub standardowym lobby.
  - *Dlaczego*: Umożliwia grę P2P/Room bez konieczności utrzymywania dedykowanego serwera WebSocket, idealnie integruje się z aplikacjami Vite/React.
- **Logika SI Komputera**:
  - *Wybrany wariant*: Tryb „Hunt & Target” (początkowo losowe strzały w siatkę parzystą, a po trafieniu polowanie na sąsiednie pola w pionie i poziomie do momentu zatopienia).
  - *Dlaczego*: Daje znacznie bardziej wciągającą i realistyczną rozgrywkę niż w 100% losowe strzały bota.
- **Restrukturyzacja kodu i plików**:
  - `src/assets/`: `board.png`, `ship.png`, `miss.png`.
  - `src/components/`:
    - `MainMenu.tsx`: ekran startowy z wyborem trybu gry.
    - `ShipPlacement.tsx`: ekran i interakcje rozstawiania statków.
    - `RadarGrid.tsx`: uniwersalny radar z interaktywnymi polami.
    - `BattleScreen.tsx`: główny widok bitwy z dwiema planszami.
    - `GameHUD.tsx`: komunikaty, tury, statystyki i kontrolki.
    - `MultiplayerModal.tsx`: tworzenie/dołączanie do pokoju online.
  - `src/logic/`:
    - `gameRules.ts`: definicje floty, sprawdzanie buforów 1 kratki, kolizji, autogenerowanie.
    - `botAI.ts`: algorytm strzałów komputera.
    - `playroomSync.ts`: adapter do synchronizacji stanu przez Playroom SDK.

---

### 4. Technical Architecture & Data Strategy

#### Diagram architektury i przepływu danych

```
┌──────────────────────────────────────────────────────────────┐
│                          App.tsx                             │
│                  (Główny automat stanów)                     │
└──────┬──────────────────────┬──────────────────────┬─────────┘
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐     ┌──────────────────┐   ┌──────────────────┐
│   MainMenu   │     │  ShipPlacement   │   │   BattleScreen   │
│  - Tryb Solo │     │ - 10 okrętów     │   │ - Siatka wroga   │
│  - Playroom  │     │ - Bufor 1 kratki │   │ - Własna siatka  │
│  - Pomoc/FAQ │     │ - Obrót / Auto   │   │ - Status i tury  │
└──────┬───────┘     └────────┬─────────┘   └────────┬─────────┘
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────────────────────────────────────────────────────┐
│                    Zarządzanie Stanem                        │
│ - gameRules.ts: walidacja kolizji i stref buforowych         │
│ - botAI.ts: algorytm Hunt & Target dla komputera             │
│ - playroomkit: synchronizacja stanów graczy i strzałów P2P   │
└──────────────────────────────────────────────────────────────┘
```

#### Struktura modeli danych (TypeScript)

```typescript
export type ShipType = 'CARRIER_4' | 'CRUISER_3' | 'DESTROYER_2' | 'PATROL_1';

export interface ShipDefinition {
  id: string;
  name: string;
  size: number;
  count: number;
}

export interface PlacedShip {
  id: string;
  type: ShipType;
  size: number;
  orientation: 'horizontal' | 'vertical';
  coordinates: string[]; // np. ["A1", "A2", "A3", "A4"]
  hits: string[];
}

export interface CellState {
  coordinate: string; // np. "B5"
  hasShip: boolean;
  status: 'empty' | 'miss' | 'hit';
  shipId?: string;
  isBufferZone?: boolean;
}
```

---

### 5. Plan wdrożenia krok po kroku

1. **Struktura katalogów i zasoby**:
   - Przeniesienie grafik do `src/assets/`.
   - Konfiguracja importów modułowych i stylów Tailwind/CSS.
2. **Instalacja pakietów**:
   - Dodanie `playroomkit` oraz `lucide-react` do `package.json`.
3. **Silnik reguł morskich (`src/logic/gameRules.ts`)**:
   - Definicja floty 10 okrętów (1x4, 2x3, 3x2, 4x1).
   - Matematyka siatki 10x10 (A–J, 1–10).
   - Walidacja bufora 1 kratki (w pionie, poziomie i po przekątnych).
   - Algorytm automatycznego losowania floty.
4. **Komponenty interfejsu (`src/components/`)**:
   - `MainMenu.tsx`: estetyczne retro menu z wyborem trybu.
   - `ShipPlacement.tsx`: intuicyjny kreator z obrotem i podglądem kolizji.
   - `RadarGrid.tsx`: uniwersalny radar z interaktywnymi polami.
   - `BattleScreen.tsx`: rozgrywka turowa z radarem własnym i przeciwnika.
5. **Implementacja sztucznej inteligencji (`src/logic/botAI.ts`)**:
   - Losowanie floty bota z zachowaniem buforów.
   - Inteligentne oddawanie strzałów z dobijaniem trafionych okrętów.
6. **Implementacja Playroom SDK (`src/logic/playroomSync.ts`)**:
   - Inicjalizacja sesji dwóch graczy, wymiana rozstawionych flot i synchronizacja oddawanych strzałów.
7. **Weryfikacja**:
   - Kompilacja (`compile_applet`), linter (`lint_applet`), testy scenariuszy rozstawiania, gry solo i online.

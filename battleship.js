var model = {
	boardSize: 7,
	numShips: 3,
	shipLength: 3,
	shipsSunk: 0,

	ships: [
		{ locations: [0, 0, 0], hits: ["", "", ""] },
		{ locations: [0, 0, 0], hits: ["", "", ""] },
		{ locations: [0, 0, 0], hits: ["", "", ""] }
	],

// Początkowe położenie okrętów, podane na stałe.
/*
	ships: [
		{ locations: ["06", "16", "26"], hits: ["", "", ""] },
		{ locations: ["24", "34", "44"], hits: ["", "", ""] },
		{ locations: ["10", "11", "12"], hits: ["", "", ""] }
	],
*/

	fire: function(guess) {
		for (var i = 0; i < this.numShips; i++) {
			var ship = this.ships[i];
			var index = ship.locations.indexOf(guess);
			
			if (ship.hits[index] === "hit") {
				view.displayMessage("Ups, już wcześniej trafiłeś to pole!");
				return true;
			} else if (index >= 0) {
				ship.hits[index] = "hit";
				view.displayHit(guess);
				view.displayMessage("TRAFIONY!");

				if (this.isSunk(ship)) {
					view.displayMessage("Zatopiłeś mój okręt!");
					this.shipsSunk++;
				}
				return true;
			}
		}
		view.displayMiss(guess);
		view.displayMessage("Spudłowałeś");
		return false;		
	},
	
	isSunk: function(ship) {
		for (var i = 0; i < this.shipLength; i++) {
			if (ship.hits[i] !== "hit") {
				return false;
			}
		}
	    return true;
	},
	
	generateShipLocations: function() {
		var locations;
		for (var i = 0; i < this.numShips; i++) {
			do {
				locations = this.generateShip();
			} while(this.collision(locations));
			this.ships[i].locations = locations;
		}
	},
	
	generateShip: function() {
		var direction = Math.floor(Math.random() * 2);
		var row, col;
		
		if (direction === 1) { // W poziomie.
			row = Math.floor(Math.random() * this.boardSize);
			col = Math.floor(Math.random() * (this.boardSize - this.shipLength));
		} else { // W pionie.
			row = Math.floor(Math.random() * (this.boardSize - this.shipLength));
			col = Math.floor(Math.random() * this.boardSize);
		}
		
		var newShipLocations = [];		
		for (var i = 0; i < this.shipLength; i++) {
			if (direction === 1) {
				newShipLocations.push(row + "" + (col + i));
			} else {
				newShipLocations.push((row + i) + "" + col);
			}
		}
		return newShipLocations;
	},
	
	collision: function(locations) {
		for (var i = 0; i < this.numShips; i++) {
			var ship = this.ships[i];			
			for (var j = 0; j < locations.length; j++) {
				if (ship.locations.indexOf(locations[j]) >= 0) {
					return true;
				}
			}
		}
		return false;
	}
};

var view = {
	displayMessage: function(msg) {
		var messageArea = document.getElementById("messageArea");
		messageArea.innerHTML = msg;
	},
	
	displayHit: function(location) {
		var cell = document.getElementById(location);
		cell.setAttribute("class", "hit");
	},
	
	displayMiss: function(location) {
		var cell = document.getElementById(location);
		cell.setAttribute("class", "miss");
	}
};

var controller = {
	guesses: 0,
	
	processGuess: function(guess) {
		var location = parseGuess(guess);
		if (location) {
			this.guesses++;
			var hit = model.fire(location);
			if (hit && model.shipsSunk === model.numShips) {
				view.displayMessage("Zatopiłeś wszystkie moje okręty, w " + this.guesses + " próbach");
			}
		}
	}
};

// Funkcja pomocnicza przetwarzająca współrzędne wpisane 
// przez użytkownika.
function parseGuess(guess) {
	var alphabet = ["A", "B", "C", "D", "E", "F", "G",];
	var guessUpper = guess.toUpperCase();
	
	if (guessUpper === null || guessUpper.length !== 2) {
		alert("Ups, proszę wpisać literę i cyfrę.");
	} else {
		var row = alphabet.indexOf(guessUpper.charAt(0));
		var column = guessUpper.charAt(1);
		
		if (isNaN(row) || isNaN(column)) {
			alert("Ups, proszęto nie są współrzędne!");
		} else if (row < 0 || row >= model.boardSize ||
						column < 0 || column >= model.boardSize) {
			alert("Ups, pole pozaplanszą!");
		} else {
			return row + column;
		}
	}
	return null;
}

function init() {
	var fireButton = document.getElementById("fireButton");
	fireButton.onclick = ognia;
	var guessInput = document.getElementById("guessInput");
	guessInput.onkeypress = handleKeyPress;
	
	model.generateShipLocations();
}

function handleKeyPress(e) {
	var fireButton = document.getElementById("fireButton");
	if (e.keyCode === 13) {
		fireButton.click();
		return false;
	}
}

function ognia() {
	var guessInput = document.getElementById("guessInput");
	var guess = guessInput.value;
	controller.processGuess(guess);
	
	guessInput.value = "";
}

window.onload = init;

/* // Test wyswietlania okretów i pudła
view.displayMiss("00");
view.displayHit("34");
view.displayMiss("55");
view.displayHit("12");
view.displayMiss("25");
view.displayHit("26");
view.displayMessage("halo, czy to działa, wygląda na to ze tak");

// -----

model.fire("00");

model.fire("06");
model.fire("54");
model.fire("16");
model.fire("26");

model.fire("34");
model.fire("34");
model.fire("24");
model.fire("44");

model.fire("12");
model.fire("56");
model.fire("11");
model.fire("10");
model.fire("52");


//----- Zadanie -----
// Strona 366 - zrobione prawidłowo;)


//które okęty zostały trafione? ships[1], ships[2];
//o które pola chodzi? C4 i A0;
//gracz sprawdza pole "D4", czy jest to pole trafione? TAK, który to okręt? ships[1]
//gracz sprawdza pole "B3", czy jest to pole trafione? NIE, który to okręt? żaden ponieważ to pudło!




var ships = [{ locations: ["31", "41", "51"], hits: [false, false, false] },
{ locations: ["14", "24", "34"], hits: [false, true, false] },
{ locations: ["00", "01", "02"], hits: [true, false, true] }];

var ship2 = ships[1];
var locations = ship2.locations;
console.log("Współrzędne pola to: " + locations[1]);

var ship3 = ships[2];
var hits = ship3.hits[0];

if (hits === true) {
	console.log("Aua, trafionie pierwszej komórki trzeciego okrętu!");
}

var ship1 = ships[0];
var hits = ship1.hits;
hits[2] = true;

if (hits[2] === true) {
	console.log("Aua, trafionie trzeciej komórki pierwszego okrętu!");
}

*/

/* 
1. W pętli obsłuż wszystkie okręty które biorą udział w grze.
2. Wygeneruj losowy kierunek (pionowy lub poziomy) w jakim zostanie rozmieszczony
poszczególny okręt.
3. Wygeneruj losowe miejsca okrętu.
4.  Sprawdz czy położenie nowego okrętu nie koliduje juz z istniejącym okrętem.
5. Dodaj położenie nowego okrętu do tablicy ships
 */
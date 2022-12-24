var loc1 = 3;
var loc2 = 4;
var loc3 = 5;

var guess;
var hits = 0;
var guesses = 0;

var isSunk = false;

while (isSunk == false) {
    guess = prompt("Podaj zakres od 0 do 6");

    if((guess < 0)||(guess > 6)) {
       alert("Proszę podać prawidłowy numer komórki!");
    } else {
        guesses += 1;
        
        if((loc1 == guess)||(loc2 == guess)||(loc3 == guess)) {
            hits += 1;
            alert("TRAFIONY!")

            if(hits == 3){
                isSunk = true;
                alert("Zatopiłeś mój okręt");
            }
        } else {
			alert("PUDŁO!");
		}
    }
}
alert("statystyki: zatopiłeś okręt w probie: "+ guesses + " Twoj efektywność wynosi: " + (3/guesses) +".");
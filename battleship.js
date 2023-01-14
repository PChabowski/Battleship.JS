var locRandom = Math.floor(Math.random()* 5);
var loc1 = locRandom;
var loc2 = loc1 + 1;
var loc3 = loc2 + 1;

var guess;
var oneHit = false, twoHit = false, treeHit = false;
var guesses = 0;

var isSunk = false;

while (isSunk == false) {
    guess = prompt("Podaj zakres od 0 do 6");

    if((guess < 0)||(guess > 6)) {
       alert("Proszę podać prawidłowy numer komórki!");
    } else {
        if((loc1 == guess)||(loc2 == guess)||(loc3 == guess)) {
            if(loc1 == guess && !oneHit){
				oneHit = true;
				alert("TRAFIONY!");
				guesses += 1;
			} else if(loc1 == guess && oneHit){ alert("To miejśce już zostało trafione! spróbuj inne!"); }
			
			if(loc2 == guess && !twoHit){
				twoHit = true;
				alert("TRAFIONY!");
				guesses += 1;
			} else if(loc2 == guess && twoHit){ alert("To miejśce już zostało trafione! spróbuj inne!"); }
			
			if(loc3 == guess && !treeHit){
				treeHit = true;
				alert("TRAFIONY!");
				guesses += 1;
			} else if(loc3 == guess && treeHit){ alert("To miejśce już zostało trafione! spróbuj inne!"); }
			
            if(oneHit && twoHit && treeHit){
                isSunk = true;
                alert("Zatopiłeś mój okręt");
            }
        } else {
			alert("PUDŁO!");
			guesses += 1;
		}
    }
}
alert("statystyki: zatopiłeś okręt w probie: "+ guesses + " Twoj efektywność wynosi: " + (3/guesses) +".");
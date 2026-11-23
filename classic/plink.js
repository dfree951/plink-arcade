// Browser port of dfree951/plinko's Plink.java. Terminal I/O is supplied by the host.
const CLEAR = '\x1b[H\x1b[2J';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const PURPLE = '\x1b[35m';

const POINTS = [3, 2, 5, 0, 5, 1, 4, 9, 2, 0, 0, 2, 9, 4, 1, 5, 0, 5, 2, 3];
const EMPTY_ROW = 'U'.repeat(POINTS.length);
const ROWS = 9;
const LOOT_BOTTOM = '|_/________\n|         |\n|         |\n|_________|';
const LOOT_ART = String.raw`         ___------__
  |\__-- /\       _ -
  |/_   __       _
  // \ /  \     /__
  |  o|  0|__      --_
  \\____-/ __ \   ___ -
  (@@   ___/  / /_
     -_____---   --_
     //  \ \\       -
   //|\__/  \\   ___ -
   \_\\_____/  \-|
       // \\--\|
  ____//  ||_
 /___//_\ /__|`;

function step(position, randomInt) {
  const direction = randomInt(2) === 1 ? 1 : -1;
  return Math.max(1, Math.min(POINTS.length, position + direction));
}

async function drop({ position, twoToken, skin, theme, write, wait, randomInt }) {
  let secondPosition = position;
  while (secondPosition === position) {
    secondPosition = randomInt(19) + 1;
  }

  const tokens = [...EMPTY_ROW];
  if (twoToken) tokens[secondPosition - 1] = skin;
  position = Math.max(1, Math.min(POINTS.length, position));
  tokens[position - 1] = skin;

  for (let row = 0; row < ROWS; row++) {
    if (row === 0) {
      write(CLEAR + '\n');
    } else {
      await wait(1000);
      write(theme + CLEAR + '\n');
      tokens[position - 1] = 'U';
      position = step(position, randomInt);
      tokens[position - 1] = skin;

      // The second token starts moving on the third frame in the Java game.
      if (twoToken && row >= 2) {
        tokens[secondPosition - 1] = 'U';
        do {
          secondPosition = step(secondPosition, randomInt);
        } while (secondPosition === position);
        tokens[secondPosition - 1] = skin;
      }
    }

    const board = Array(ROWS).fill(EMPTY_ROW);
    board[row] = tokens.map(token => token === skin ? CYAN + token + theme : token).join('');
    write(board.join('\n') + YELLOW + '\n' + POINTS.join(''));
  }

  const earned = POINTS[position - 1] + (twoToken ? POINTS[secondPosition - 1] : 0);
  return skin.includes('$') ? earned * 2 : earned;
}

export async function playPlink({ write, read, wait, randomInt = max => Math.floor(Math.random() * max) }) {
  const print = text => write(text + '\n');
  const textInput = label => read({ label });
  const numberInput = (label, choices) => read({ label, integer: true, choices });

  write(CLEAR);
  let total = 6;
  let plays = 0;
  let previous = -1;
  let twoToken = false;
  let freebie = false;
  let hide = false;
  let dontAsk = false;
  let theme = WHITE;
  let skin = 'O';
  const collection = [skin];

  while (total >= 2) {
    let gameCost = 2;
    let again = 'y';
    if (plays > 0) {
      if (plays % 3 === 0) {
        print('Play Again? (2 Credits) y/n/gamble/box : ');
        print('Loot box available with selection "b"');
      } else if (!hide) {
        print('Play Again? (2 Credits) y/n/gamble/skins : ');
      } else {
        print('Play Again? (2 Credits) y/n/gamble/skins/unhideShop : ');
      }
      again = await textInput('Play again');
    }

    if (again === 'n') {
      print('\nBye');
      break;
    }
    if (again.includes('u')) hide = false;

    if (again.includes('s')) {
      print('Select skin: ');
      write(collection.map((item, index) => `${index + 1}: ${item} , `).join(''));
      const selection = await numberInput('Skin number', collection.map((_, index) => index + 1));
      skin = collection[selection - 1];
      print('Skin Updated: ' + skin);
    }

    if (again.includes('b') && plays % 3 === 0) {
      print(CLEAR + ' __________\n|         |\n|  loot   |\n|_________|\n|         |\n|         |\n|_________|');
      await wait(1000);
      const lid = '___________\n|loot __--/  \n|  __/';
      print(CLEAR + lid + '\n' + LOOT_BOTTOM);
      await wait(1000);

      const loot = ['B', '50 credits', '+', '!', '%', '~', '&', '*', YELLOW + '$' + theme, LOOT_ART];
      const prize = loot[randomInt(loot.length)];
      print(CLEAR + lid + ' ' + prize + '   \n' + LOOT_BOTTOM);
      await wait(1000);

      if (prize.includes('credits')) {
        total = (total + 50) | 0;
      } else {
        print('Press 1 for OK, 2 for Select Skin');
        if ((await textInput('Loot box selection')).includes('2')) skin = prize;
        collection.push(skin);
      }
    }

    if (again.includes('g')) {
      print('Winning chance: 1/3 , Payout: x3');
      const available = (total - 2) | 0;
      print(`You have: ${available} , Bet: `);
      let bet = await numberInput('Bet');
      if (bet > available) {
        print('Bet reduced to "all in"');
        bet = available;
      }
      bet = Math.max(0, bet);
      // The original message says 1/3, while the original draw has two outcomes.
      if (randomInt(2) === 0) {
        total = (total + bet * 2) | 0;
        print(`You win. New Total: ${(total - 2) | 0}`);
      } else {
        print('You lose.');
        total = (total - bet) | 0;
        if (total < 2) {
          print('Insufficient Credits Remaining.');
          break;
        }
      }
    }

    if (!freebie) twoToken = false;

    if (((total - 2) | 0) >= 10 && !hide) {
      print('Visit Shop? (y/n/hide forever)');
      const visit = await textInput('Visit shop');
      if (visit.includes('h')) hide = true;
      if (visit.includes('y')) {
        const shopItems = [YELLOW + '#' + theme, YELLOW + '@' + theme, PURPLE, GREEN];
        const costs = [100, 100, 1000, 1000];
        print(`\nCredits: ${total}`);
        print('Choose a Skin (1: # :100 Credits , 2: @ :100 Credits)');
        print('Or Recolor the Board (3: Purple : 1000 Credits , 4: Green : 1000 Credits)');
        print('9 to exit');

        const retryPurchase = async () => {
          print('Insufficient Credits');
          print('Choose a Skin (1,2): ');
          print(`[${shopItems.join(', ')}]`);
          return numberInput('Shop selection', [1, 2, 3, 4]);
        };

        let choice = await numberInput('Shop selection', [1, 2, 3, 4, 9]);
        if (choice >= 3 && choice !== 9) {
          if (((total - 2) | 0) < costs[choice - 1]) choice = await retryPurchase();
          if (((total - 2) | 0) >= costs[choice - 1]) {
            total = (total - costs[choice - 1]) | 0;
            theme = shopItems[choice - 1];
            print(theme + 'Color Changed.');
          }
        }
        if (choice <= 2) {
          if (((total - 2) | 0) < costs[choice - 1]) choice = await retryPurchase();
          if (((total - 2) | 0) >= costs[choice - 1]) {
            total = (total - costs[choice - 1]) | 0;
            skin = shopItems[choice - 1];
            collection.push(skin);
            print('Skin acquired: ' + skin);
          }
        }
      }
    }

    total = (total - 2) | 0;
    if (total >= 3 && plays > 0 && !dontAsk) {
      print(`Activate Double Token Mode for 3 Points? Current Total: ${total}\nLocation of Second Token is Random.\n(y/n/assumeDouble): `);
      const pay = await textInput('Double token mode');
      if (pay.includes('a')) {
        dontAsk = true;
        twoToken = true;
        total -= 3;
        gameCost += 3;
        print('Always Double.');
      }
      if (pay.includes('y')) {
        twoToken = true;
        total -= 3;
        gameCost += 3;
        print('Activated.');
      } else {
        // The assignment in Plink.java clears freebie and leaves twoToken as-is.
        freebie = false;
      }
    } else if (total >= 3 && plays > 0 && dontAsk) {
      twoToken = true;
      total -= 3;
      gameCost += 3;
    }

    print(theme + 'Credits: ' + total);
    if (plays === 0) print('First Game is Free.');
    print('\nStart position 1-20: ');
    const position = await numberInput('Start position');
    const earned = await drop({ position, twoToken, skin, theme, write, wait, randomInt });

    total = (total + earned) | 0;
    print(`${theme}\n\nEarned: ${earned} points after spending ${gameCost}`);
    plays++;
    print(`Total: ${total} points in ${plays} play/s`);
    if (previous === earned) {
      print('Two in a row!');
      if (previous === 0 && total >= 2) {
        print('Two zeros? Double Token Activated.');
        freebie = true;
        twoToken = true;
      } else {
        freebie = false;
        twoToken = false;
      }
    }
    previous = earned;
    if (total < 2) print('Insufficient Credits for New Game');
  }
}

import { playPlink } from './plink.js';

const screen = document.querySelector('#screen');
const command = document.querySelector('#command');
const prompt = document.querySelector('#prompt');
const answer = document.querySelector('#answer');
const inputError = document.querySelector('#input-error');
const restart = document.querySelector('#restart');
const ansiSequence = /\x1b\[(H|2J|3[23567]m)/g;

let color = '';
let pending;

function write(output) {
  let start = 0;
  for (const match of output.matchAll(ansiSequence)) {
    append(output.slice(start, match.index));
    const code = match[1];
    if (code === '2J') screen.replaceChildren();
    if (code.endsWith('m')) color = code.slice(0, -1);
    start = match.index + match[0].length;
  }
  append(output.slice(start));
}

function append(text) {
  if (!text) return;

  if (screen.lastElementChild?.dataset.color === color) {
    screen.lastElementChild.append(text);
    return;
  }

  const span = document.createElement('span');
  span.dataset.color = color;
  if (color) span.className = `ansi-${color}`;
  span.textContent = text;
  screen.append(span);
}

function read(request) {
  prompt.textContent = request.label;
  answer.inputMode = request.integer ? 'decimal' : 'text';
  answer.value = '';
  inputError.textContent = '';
  command.hidden = false;
  answer.focus();
  return new Promise(resolve => { pending = { ...request, resolve }; });
}

command.addEventListener('submit', event => {
  event.preventDefault();
  if (!pending) return;

  let response = answer.value;
  if (pending.integer) {
    const firstToken = response.trim().split(/\s+/, 1)[0];
    if (!/^[+-]?\d+$/.test(firstToken) || +firstToken < -2147483648 || +firstToken > 2147483647) {
      inputError.textContent = 'Enter a whole number.';
      answer.focus();
      return;
    }
    response = Number(firstToken);
    if (pending.choices && !pending.choices.includes(response)) {
      inputError.textContent = `Enter one of the listed numbers (${pending.choices.join(', ')}).`;
      answer.focus();
      return;
    }
  }

  const { resolve } = pending;
  pending = undefined;
  command.hidden = true;
  write(answer.value + '\n');
  resolve(response);
});

async function start() {
  restart.hidden = true;
  color = '';
  try {
    await playPlink({ write, read, wait: delay => new Promise(resolve => setTimeout(resolve, delay)) });
  } catch (error) {
    console.error(error);
    write('\nPlink ran into an error. Start a new game to play again.\n');
  } finally {
    restart.hidden = false;
    restart.focus();
  }
}

restart.addEventListener('click', start);
start();

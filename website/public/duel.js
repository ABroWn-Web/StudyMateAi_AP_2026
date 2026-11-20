// public/duel.js - runs in the BROWSER during a duel.
// Shows one question ("move") at a time and runs a chess clock:
// your time counts down; each answer adds the increment (e.g. +2 s in Blitz 3+2).
const form = document.getElementById('duel-form');
const clockEl = document.getElementById('clock');
const moves = [...document.querySelectorAll('.move')];
const increment = Number(clockEl.dataset.increment) * 1000;
let timeLeft = Number(clockEl.dataset.base) * 1000;   // milliseconds left on my clock
let current = 0;                                        // index of the question on screen
let moveStartedAt = Date.now();
let lastTick = Date.now();
let finished = false;

function showClock() {
  const s = Math.max(0, Math.ceil(timeLeft / 1000));
  clockEl.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  clockEl.classList.toggle('low', s <= 10);             // turns red in the last 10 seconds
}

function finish(reason) {
  if (finished) return;
  finished = true;
  if (reason === 'timeout') form.elements.timed_out.value = '1';
  if (reason === 'resign') form.elements.resign.value = '1';
  form.submit();                                        // POST /duels/:id/finish
}

// the clock ticks 5 times per second
setInterval(() => {
  const now = Date.now();
  timeLeft -= now - lastTick;
  lastTick = now;
  showClock();
  if (timeLeft <= 0) finish('timeout');                 // flag fell = you lose on time
}, 200);

// clicking an answer = making a move
moves.forEach((move) => {
  move.querySelectorAll('.answer').forEach((button) => {
    button.addEventListener('click', () => {
      const qid = move.dataset.qid;
      form.elements['q' + qid].value = button.dataset.option;           // my answer
      form.elements['t' + qid].value = Date.now() - moveStartedAt;      // time I took
      timeLeft += increment;
      move.classList.add('hidden');
      current++;
      if (current < moves.length) {
        moves[current].classList.remove('hidden');
        moveStartedAt = Date.now();
      } else {
        finish('done');
      }
    });
  });
});

document.getElementById('resign').addEventListener('click', () => {
  if (confirm('Resign this duel?')) finish('resign');
});
showClock();

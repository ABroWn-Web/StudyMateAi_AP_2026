// public/focus.js - runs in the BROWSER: counts down the running focus session.
const timer = document.getElementById('timer');
const endsAt = Number(timer.dataset.ends);   // milliseconds since 1970, sent by the server

function tick() {
  const left = Math.max(0, endsAt - Date.now());
  const s = Math.ceil(left / 1000);
  timer.textContent = left === 0
    ? 'Break time! ♞'
    : String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
tick();
setInterval(tick, 1000);

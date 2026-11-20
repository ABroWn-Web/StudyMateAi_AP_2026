// public/countdown.js - runs in the BROWSER: counts down to the tournament launch.
const box = document.getElementById('countdown');
const launch = Number(box.dataset.launch);   // milliseconds since 1970, sent by the server

function tick() {
  let left = Math.max(0, Math.floor((launch - Date.now()) / 1000));   // seconds left
  const parts = { days: Math.floor(left / 86400), hours: Math.floor(left / 3600) % 24,
                  minutes: Math.floor(left / 60) % 60, seconds: left % 60 };
  for (const [unit, value] of Object.entries(parts)) {
    box.querySelector(`[data-unit="${unit}"]`).textContent = String(value).padStart(2, '0');
  }
}
tick();
setInterval(tick, 1000);

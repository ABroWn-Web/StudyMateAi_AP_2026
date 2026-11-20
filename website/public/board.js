// public/board.js - runs in the BROWSER: draws a chessboard from a FEN string
// and lets you click a move (click a piece, then its target square).
// FEN example: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1"
//   ranks 8 -> 1 separated by "/", letters = pieces (UPPER = White), digits = empty squares.
const PIECES = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const boardEl = document.getElementById('board');
const moveInput = document.getElementById('move');
const [placement, sideToMove] = boardEl.dataset.fen.split(' ');
const flipped = sideToMove === 'b';          // show the board from the side that is to move
let selected = null;

// 1. FEN -> 8 rows of 8 squares (row 0 = rank 8)
const rows = placement.split('/').map((rank) => {
  const squares = [];
  for (const ch of rank) {
    if (/[1-8]/.test(ch)) for (let i = 0; i < Number(ch); i++) squares.push(null);
    else squares.push(ch);
  }
  return squares;
});

// 2. draw the 64 squares
for (let r = 0; r < 8; r++) {
  for (let c = 0; c < 8; c++) {
    const row = flipped ? 7 - r : r;
    const col = flipped ? 7 - c : c;
    const square = document.createElement('div');
    square.className = 'sq ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
    square.dataset.name = 'abcdefgh'[col] + (8 - row);              // e.g. "d1"
    const piece = rows[row][col];
    if (piece) {
      const span = document.createElement('span');
      span.textContent = PIECES[piece.toLowerCase()];
      span.className = piece === piece.toUpperCase() ? 'piece-w' : 'piece-b';
      square.appendChild(span);
    }
    if (c === 0) {                                                    // rank numbers on the left edge
      const label = document.createElement('i');
      label.className = 'coord';
      label.textContent = 8 - row;
      square.appendChild(label);
    }
    square.addEventListener('click', () => clickSquare(square));
    boardEl.appendChild(square);
  }
}

// 3. first click picks a piece, second click picks the target -> "d1d8"
function clickSquare(square) {
  if (!selected) {
    if (!square.querySelector('.piece-w, .piece-b')) return;
    selected = square;
    square.classList.add('selected');
    return;
  }
  if (square !== selected) moveInput.value = selected.dataset.name + square.dataset.name;
  selected.classList.remove('selected');
  selected = null;
}

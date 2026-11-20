// lib/elo.js - the chess rating (Elo) formula, used for students AND questions.
// Idea: every question is an "opponent" with its own rating.
//   expected score = chance I win (answer correctly) = 1 / (1 + 10^((opponent - me) / 400))
//   new rating     = old rating + K * (actual score - expected score)
// actual score: 1 = win (correct), 0.5 = draw, 0 = loss (wrong).
const K = 32; // how fast ratings move (chess sites use 10-40)

function expectedScore(myRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
}

function ratingChange(myRating, opponentRating, score) {
  return Math.round(K * (score - expectedScore(myRating, opponentRating)));
}

module.exports = { expectedScore, ratingChange };

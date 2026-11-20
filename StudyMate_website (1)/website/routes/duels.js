// routes/duels.js - quiz duels on a chess clock (you are always White).
// The rival's answers are simulated from their rating with the Elo formula:
// chance they answer a question correctly = expectedScore(rival rating, question rating).
const express = require('express');
const db = require('../db');
const { expectedScore, ratingChange } = require('../lib/elo');
const { groupOptions } = require('./quizzes');
const { wrap, getSubjects, subjectFrom, flash } = require('../lib/helpers');
const router = express.Router();

const CLOCKS = { bullet: [60, 0], blitz: [180, 2], rapid: [600, 0] };   // [base seconds, increment]

router.get('/duels', wrap(async (req, res) => {
  const me = req.session.user.user_id;
  const subject = subjectFrom(req);
  // R9: rivals closest to my rating (within +-100), like chess matchmaking
  const rivals = await db.query(
    `SELECT u.user_id, u.username, other.rating, abs(other.rating - mine.rating) AS gap
     FROM user_ratings mine
     JOIN user_ratings other ON other.subject_id = mine.subject_id AND other.user_id <> mine.user_id
                            AND other.rating BETWEEN mine.rating - 100 AND mine.rating + 100
     JOIN users u ON u.user_id = other.user_id
     WHERE mine.user_id = $1 AND mine.subject_id = $2
     ORDER BY gap, u.user_id
     LIMIT 6`, [me, subject]);
  // R11: my last 10 finished duels
  const history = await db.query(
    `SELECT d.duel_id, d.ended_at, me.color, opp_user.username AS opponent, d.result, d.termination, me.rating_change
     FROM quiz_attempts my_attempt
     JOIN duel_players me ON me.attempt_id = my_attempt.attempt_id
     JOIN duels d ON d.duel_id = me.duel_id
     JOIN duel_players opp ON opp.duel_id = d.duel_id AND opp.color <> me.color
     JOIN quiz_attempts opp_attempt ON opp_attempt.attempt_id = opp.attempt_id
     JOIN users opp_user ON opp_user.user_id = opp_attempt.user_id
     WHERE my_attempt.user_id = $1 AND d.ended_at IS NOT NULL
     ORDER BY d.ended_at DESC LIMIT 10`, [me]);
  res.render('duels', { subjects: await getSubjects(), subject, rivals, history });
}));

// W6: create the duel, one attempt per player (same quiz), both players with their rating
router.post('/duels/challenge', wrap(async (req, res) => {
  const me = req.session.user.user_id;
  const subject = subjectFrom(req);
  const [base, inc] = CLOCKS[req.body.clock] || CLOCKS.blitz;
  const duelId = await db.transaction(async (client) => {
    const { rows: [quiz] } = await client.query(
      `SELECT q.quiz_id FROM quizzes q
       WHERE q.subject_id = $1 AND EXISTS (SELECT 1 FROM quiz_questions qq WHERE qq.quiz_id = q.quiz_id)
       ORDER BY random() LIMIT 1`, [subject]);
    const { rows: [duel] } = await client.query(
      'INSERT INTO duels (base_seconds, increment_seconds) VALUES ($1, $2) RETURNING duel_id', [base, inc]);
    for (const [color, userId] of [['WHITE', me], ['BLACK', req.body.rival_id]]) {
      const { rows: [attempt] } = await client.query(
        'INSERT INTO quiz_attempts (quiz_id, user_id) VALUES ($1, $2) RETURNING attempt_id', [quiz.quiz_id, userId]);
      await client.query(
        `INSERT INTO duel_players (duel_id, color, attempt_id, rating_before)
         SELECT $1, $2, $3, rating FROM user_ratings WHERE user_id = $4 AND subject_id = $5`,
        [duel.duel_id, color, attempt.attempt_id, userId, subject]);
    }
    return duel.duel_id;
  });
  res.redirect(`/duels/${duelId}/play`);
}));

// Load a duel with both players (and check that I am in it)
async function loadDuel(duelId, me) {
  const players = await db.query(
    `SELECT dp.color, dp.attempt_id, dp.rating_before, dp.rating_change, a.user_id, a.quiz_id, u.username,
            d.result, d.termination, d.base_seconds, d.increment_seconds, d.ended_at, q.subject_id
     FROM duel_players dp
     JOIN duels d ON d.duel_id = dp.duel_id
     JOIN quiz_attempts a ON a.attempt_id = dp.attempt_id
     JOIN quizzes q ON q.quiz_id = a.quiz_id
     JOIN users u ON u.user_id = a.user_id
     WHERE dp.duel_id = $1`, [duelId]);
  const mine = players.find((p) => p.user_id === me);
  if (!mine) return null;
  return { mine, rival: players.find((p) => p !== mine) };
}

router.get('/duels/:id/play', wrap(async (req, res) => {
  const duel = await loadDuel(req.params.id, req.session.user.user_id);
  if (!duel) return res.status(404).render('error', { message: 'Duel not found.' });
  if (duel.mine.ended_at) return res.redirect('/duels/' + req.params.id);
  const rows = await db.query(
    `SELECT qq.position, qs.question_id, qs.question_text, o.option_no, o.option_text
     FROM quiz_questions qq
     JOIN questions qs ON qs.question_id = qq.question_id
     JOIN question_options o ON o.question_id = qs.question_id
     WHERE qq.quiz_id = $1 ORDER BY qq.position, o.option_no`, [duel.mine.quiz_id]);
  res.render('duel_play', { duelId: req.params.id, duel, questions: groupOptions(rows) });
}));

// Finish the duel: save my answers, simulate the rival, decide the result, update both ratings
router.post('/duels/:id/finish', wrap(async (req, res) => {
  const me = req.session.user.user_id;
  const duel = await loadDuel(req.params.id, me);
  if (!duel || duel.mine.ended_at) return res.redirect('/duels/' + req.params.id);
  const resigned = req.body.resign === '1';
  const timedOut = req.body.timed_out === '1';

  await db.transaction(async (client) => {
    const { rows: questions } = await client.query(
      `SELECT qq.question_id, qs.question_rating, o.option_no AS correct_no
       FROM quiz_questions qq
       JOIN questions qs ON qs.question_id = qq.question_id
       JOIN question_options o ON o.question_id = qq.question_id AND o.is_correct
       WHERE qq.quiz_id = $1 ORDER BY qq.position`, [duel.mine.quiz_id]);

    let myScore = 0, rivalScore = 0;
    for (const q of questions) {
      // my answer (empty if I never reached the question)
      const chosen = req.body['q' + q.question_id] ? parseInt(req.body['q' + q.question_id], 10) : null;
      const ms = parseInt(req.body['t' + q.question_id], 10) || 0;
      if (chosen === q.correct_no) myScore++;
      await client.query(
        'INSERT INTO attempt_answers (attempt_id, question_id, chosen_option_no, time_taken_ms) VALUES ($1, $2, $3, $4)',
        [duel.mine.attempt_id, q.question_id, chosen, ms]);
      // the rival: correct with probability = Elo expected score against the question
      const rivalCorrect = Math.random() < expectedScore(duel.rival.rating_before, q.question_rating);
      const rivalChoice = rivalCorrect ? q.correct_no : (q.correct_no % 4) + 1;   // some wrong option
      if (rivalCorrect) rivalScore++;
      await client.query(
        'INSERT INTO attempt_answers (attempt_id, question_id, chosen_option_no, time_taken_ms) VALUES ($1, $2, $3, $4)',
        [duel.rival.attempt_id, q.question_id, rivalChoice, 4000 + Math.floor(Math.random() * 14000)]);
    }

    // Result from White's (my) side: 1 = win, 0.5 = draw, 0 = loss
    let score, termination;
    if (resigned)      { score = 0; termination = 'RESIGN'; }
    else if (timedOut) { score = 0; termination = 'TIMEOUT'; }
    else { score = myScore > rivalScore ? 1 : myScore < rivalScore ? 0 : 0.5; termination = 'SCORE'; }
    const result = score === 1 ? '1-0' : score === 0 ? '0-1' : '1/2-1/2';
    const change = ratingChange(duel.mine.rating_before, duel.rival.rating_before, score);

    // W7: close the duel, store the rating changes, update both players' ratings
    await client.query("UPDATE duels SET result = $2, termination = $3, ended_at = now() WHERE duel_id = $1",
                       [req.params.id, result, termination]);
    await client.query(
      "UPDATE duel_players SET rating_change = CASE color WHEN 'WHITE' THEN $2::int ELSE -$2::int END WHERE duel_id = $1",
      [req.params.id, change]);
    await client.query('UPDATE quiz_attempts SET finished_at = now() WHERE attempt_id IN ($1, $2)',
                       [duel.mine.attempt_id, duel.rival.attempt_id]);
    for (const [userId, delta] of [[me, change], [duel.rival.user_id, -change]]) {
      await client.query(
        `UPDATE user_ratings SET rating = greatest(100, least(3500, rating + $3)), updated_at = now()
         WHERE user_id = $1 AND subject_id = $2`, [userId, duel.mine.subject_id, delta]);
    }
    flash(req, change >= 0 ? 'success' : 'error',
          `${result === '1-0' ? 'You won' : result === '0-1' ? 'You lost' : 'Draw'} (${myScore}–${rivalScore}). `
          + `Rating ${change >= 0 ? '+' : ''}${change}.`);
  });
  res.redirect('/duels/' + req.params.id);
}));

// R10: the scoresheet - both players, the result, and every "move" (question)
router.get('/duels/:id', wrap(async (req, res) => {
  const duel = await loadDuel(req.params.id, req.session.user.user_id);
  if (!duel) return res.status(404).render('error', { message: 'Duel not found.' });
  if (!duel.mine.ended_at) return res.redirect(`/duels/${req.params.id}/play`);
  const white = duel.mine.color === 'WHITE' ? duel.mine : duel.rival;
  const black = white === duel.mine ? duel.rival : duel.mine;
  const moves = await db.query(
    `SELECT qq.position, qs.question_text,
            wa.chosen_option_no IS NOT NULL AND wa.chosen_option_no = c.option_no AS white_ok, wa.time_taken_ms AS white_ms,
            ba.chosen_option_no IS NOT NULL AND ba.chosen_option_no = c.option_no AS black_ok, ba.time_taken_ms AS black_ms
     FROM quiz_questions qq
     JOIN questions qs ON qs.question_id = qq.question_id
     JOIN question_options c ON c.question_id = qq.question_id AND c.is_correct
     LEFT JOIN attempt_answers wa ON wa.attempt_id = $2 AND wa.question_id = qq.question_id
     LEFT JOIN attempt_answers ba ON ba.attempt_id = $3 AND ba.question_id = qq.question_id
     WHERE qq.quiz_id = $1
     ORDER BY qq.position`, [white.quiz_id, white.attempt_id, black.attempt_id]);
  const score = (key) => moves.filter((m) => m[key]).length;
  res.render('duel_sheet', { duelId: req.params.id, white, black, moves,
                             whiteScore: score('white_ok'), blackScore: score('black_ok') });
}));

module.exports = router;

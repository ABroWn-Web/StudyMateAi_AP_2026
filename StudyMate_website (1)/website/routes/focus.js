// routes/focus.js - Pomodoro focus sessions; the break is a chess puzzle.
const express = require('express');
const db = require('../db');
const { wrap, getSubjects, flash } = require('../lib/helpers');
const router = express.Router();

// My running session (started in the last 12 hours and not ended yet)
async function runningSession(me) {
  const [s] = await db.query(
    `SELECT ss.session_id, ss.started_at, ss.planned_minutes, s.subject_name
     FROM study_sessions ss JOIN subjects s ON s.subject_id = ss.subject_id
     WHERE ss.user_id = $1 AND ss.ended_at IS NULL AND ss.started_at > now() - interval '12 hours'
     ORDER BY ss.started_at DESC LIMIT 1`, [me]);
  return s || null;
}

router.get('/focus', wrap(async (req, res) => {
  const me = req.session.user.user_id;
  // R15: this week's minutes and puzzles per subject
  const stats = await db.query(
    `SELECT s.subject_name, count(*)::int AS sessions,
            round(sum(EXTRACT(EPOCH FROM (ss.ended_at - ss.started_at))) / 60)::int AS minutes,
            count(*) FILTER (WHERE ss.puzzle_solved)::int AS puzzles
     FROM study_sessions ss JOIN subjects s ON s.subject_id = ss.subject_id
     WHERE ss.user_id = $1 AND ss.started_at >= now() - interval '7 days' AND ss.ended_at IS NOT NULL
     GROUP BY s.subject_name ORDER BY minutes DESC`, [me]);
  res.render('focus', { running: await runningSession(me), stats, subjects: await getSubjects() });
}));

// W10: start a session
router.post('/focus/start', wrap(async (req, res) => {
  const me = req.session.user.user_id;
  if (!(await runningSession(me))) {
    await db.query('INSERT INTO study_sessions (user_id, subject_id, planned_minutes) VALUES ($1, $2, $3)',
                   [me, req.body.subject || 1, req.body.minutes === '50' ? 50 : 25]);
  }
  res.redirect('/focus');
}));

// R16: the break puzzle - one I have not seen, close to my average rating
router.get('/focus/break', wrap(async (req, res) => {
  const me = req.session.user.user_id;
  const running = await runningSession(me);
  if (!running) return res.redirect('/focus');
  const [puzzle] = await db.query(
    `SELECT p.puzzle_id, p.fen, p.theme, p.puzzle_rating
     FROM chess_puzzles p
     WHERE NOT EXISTS (SELECT 1 FROM study_sessions ss WHERE ss.user_id = $1 AND ss.puzzle_id = p.puzzle_id)
     ORDER BY abs(p.puzzle_rating - (SELECT avg(rating) FROM user_ratings WHERE user_id = $1)), p.puzzle_id
     LIMIT 1`, [me]);
  res.render('focus_break', { running, puzzle });
}));

// W11: end the session and record the puzzle (solved if my move = the first solution move)
router.post('/focus/break', wrap(async (req, res) => {
  const me = req.session.user.user_id;
  const running = await runningSession(me);
  if (!running) return res.redirect('/focus');
  if (!/^\d+$/.test(req.body.puzzle_id || '')) return res.redirect('/focus/break');
  const [puzzle] = await db.query('SELECT puzzle_id, solution_moves FROM chess_puzzles WHERE puzzle_id = $1', [req.body.puzzle_id]);
  const solved = (req.body.move || '').trim().toLowerCase() === puzzle.solution_moves.split(' ')[0];
  await db.query(
    'UPDATE study_sessions SET ended_at = now(), puzzle_id = $2, puzzle_solved = $3 WHERE session_id = $1',
    [running.session_id, puzzle.puzzle_id, solved]);
  flash(req, solved ? 'success' : 'error',
        solved ? 'Checkmate! Puzzle solved. Session saved.' : `Not quite: the winning move was ${puzzle.solution_moves}. Session saved.`);
  res.redirect('/focus');
}));

module.exports = router;

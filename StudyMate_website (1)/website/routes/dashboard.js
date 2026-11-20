// routes/dashboard.js - the home screen after login.
const express = require('express');
const db = require('../db');
const { wrap } = require('../lib/helpers');
const router = express.Router();

router.get('/dashboard', wrap(async (req, res) => {
  const me = req.session.user.user_id;

  // R2: my rating + chess title in every subject (and the next title, for the progress bar)
  const ratings = await db.query(
    `SELECT s.subject_id, s.subject_name, ur.rating, t.title_code, t.title_name,
            nxt.title_name AS next_title, nxt.min_rating AS next_min, t.min_rating AS cur_min
     FROM user_ratings ur
     JOIN subjects s ON s.subject_id = ur.subject_id
     CROSS JOIN LATERAL (SELECT * FROM titles WHERE min_rating <= ur.rating
                         ORDER BY min_rating DESC LIMIT 1) t
     LEFT JOIN LATERAL (SELECT * FROM titles WHERE min_rating > ur.rating
                        ORDER BY min_rating LIMIT 1) nxt ON true
     WHERE ur.user_id = $1
     ORDER BY s.subject_id`, [me]);

  // R13 (count only): mistakes due for revision today
  const [due] = await db.query(
    'SELECT count(*)::int AS n FROM mistake_notebook WHERE user_id = $1 AND next_review_on <= current_date', [me]);

  // R15 (total): focus minutes and puzzles solved this week
  const [focus] = await db.query(
    `SELECT coalesce(round(sum(EXTRACT(EPOCH FROM (ended_at - started_at))) / 60), 0)::int AS minutes,
            count(*) FILTER (WHERE puzzle_solved)::int AS puzzles
     FROM study_sessions
     WHERE user_id = $1 AND started_at >= now() - interval '7 days' AND ended_at IS NOT NULL`, [me]);

  // R14: my 3 weakest topics in the last 30 days
  const weak = await db.query(
    `SELECT tp.topic_name, count(*)::int AS answered,
            round(100.0 * count(*) FILTER (WHERE o.is_correct) / count(*))::int AS accuracy
     FROM quiz_attempts a
     JOIN attempt_answers aa ON aa.attempt_id = a.attempt_id
     JOIN questions qs ON qs.question_id = aa.question_id
     JOIN topics tp ON tp.topic_id = qs.topic_id
     LEFT JOIN question_options o ON o.question_id = aa.question_id AND o.option_no = aa.chosen_option_no
     WHERE a.user_id = $1 AND a.started_at >= now() - interval '30 days'
     GROUP BY tp.topic_id, tp.topic_name
     HAVING count(*) >= 3
     ORDER BY accuracy, answered DESC
     LIMIT 3`, [me]);

  // R11: my last 3 finished duels
  const duels = await db.query(
    `SELECT d.duel_id, d.ended_at, me.color, opp_user.username AS opponent, d.result, me.rating_change
     FROM quiz_attempts my_attempt
     JOIN duel_players me ON me.attempt_id = my_attempt.attempt_id
     JOIN duels d ON d.duel_id = me.duel_id
     JOIN duel_players opp ON opp.duel_id = d.duel_id AND opp.color <> me.color
     JOIN quiz_attempts opp_attempt ON opp_attempt.attempt_id = opp.attempt_id
     JOIN users opp_user ON opp_user.user_id = opp_attempt.user_id
     WHERE my_attempt.user_id = $1 AND d.ended_at IS NOT NULL
     ORDER BY d.ended_at DESC LIMIT 3`, [me]);

  res.render('dashboard', { ratings, due: due.n, focus, weak, duels });
}));

module.exports = router;

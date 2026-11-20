// routes/practice.js - Adaptive practice: "every question is an opponent".
// The app picks the unseen question whose Elo rating is closest to yours,
// so it is always a fair "game" (about a 50% chance to win).
const express = require('express');
const db = require('../db');
const { expectedScore } = require('../lib/elo');
const { gradeAnswer } = require('../lib/grading');
const { wrap, getSubjects, subjectFrom } = require('../lib/helpers');
const router = express.Router();

router.get('/practice', wrap(async (req, res) => {
  const me = req.session.user.user_id;
  const subject = subjectFrom(req);

  // my rating + title in this subject
  const [mine] = await db.query(
    `SELECT ur.rating, t.title_name
     FROM user_ratings ur
     CROSS JOIN LATERAL (SELECT title_name FROM titles WHERE min_rating <= ur.rating
                         ORDER BY min_rating DESC LIMIT 1) t
     WHERE ur.user_id = $1 AND ur.subject_id = $2`, [me, subject]);

  // R12: the unseen question closest to my rating
  const [question] = await db.query(
    `SELECT qs.question_id, qs.question_text, qs.question_rating, tp.topic_name
     FROM topics tp
     JOIN questions qs ON qs.topic_id = tp.topic_id
     WHERE tp.subject_id = $2
       AND NOT EXISTS (SELECT 1 FROM attempt_answers aa
                       JOIN quiz_attempts a ON a.attempt_id = aa.attempt_id
                       WHERE a.user_id = $1 AND aa.question_id = qs.question_id)
     ORDER BY abs(qs.question_rating - $3), qs.question_id
     LIMIT 1`, [me, subject, mine.rating]);

  let options = [];
  if (question) {
    options = await db.query(   // never send is_correct to the browser
      'SELECT option_no, option_text FROM question_options WHERE question_id = $1 ORDER BY option_no',
      [question.question_id]);
  }
  const winChance = question ? Math.round(100 * expectedScore(mine.rating, question.question_rating)) : null;
  const last = req.session.lastAnswer || null;    // result of the previous answer
  delete req.session.lastAnswer;

  res.render('practice', { subjects: await getSubjects(), subject, mine, question, options, winChance, last,
                           shownAt: Date.now() });
}));

router.post('/practice/answer', wrap(async (req, res) => {
  const me = req.session.user.user_id;
  const subject = subjectFrom(req);
  if (!/^\d+$/.test(req.body.question_id || '')) return res.redirect('/practice?subject=' + subject);

  const result = await db.transaction(async (client) => {
    // Practice answers belong to my open attempt on this subject's "Adaptive Practice" quiz
    const { rows: [quiz] } = await client.query(
      "SELECT quiz_id FROM quizzes WHERE subject_id = $1 AND title LIKE 'Adaptive Practice%' LIMIT 1", [subject]);
    let { rows: [attempt] } = await client.query(
      'SELECT attempt_id FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND finished_at IS NULL LIMIT 1',
      [quiz.quiz_id, me]);
    if (!attempt) {   // W3: first practice answer -> open a practice attempt
      ({ rows: [attempt] } = await client.query(
        'INSERT INTO quiz_attempts (quiz_id, user_id) VALUES ($1, $2) RETURNING attempt_id', [quiz.quiz_id, me]));
    }
    return gradeAnswer(client, {
      userId: me, attemptId: attempt.attempt_id, questionId: req.body.question_id,
      chosen: req.body.option, timeMs: Date.now() - Number(req.body.shown_at || Date.now()),
    });
  });

  req.session.lastAnswer = result;
  res.redirect('/practice?subject=' + subject);
}));

module.exports = router;

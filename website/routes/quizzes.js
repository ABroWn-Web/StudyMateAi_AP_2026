// routes/quizzes.js - quiz library, AI quiz generator, playing a quiz, results.
const express = require('express');
const db = require('../db');
const { gradeAnswer } = require('../lib/grading');
const { wrap, getSubjects, subjectFrom, flash } = require('../lib/helpers');
const router = express.Router();

// R5: quiz library of a subject (practice "quizzes" have no fixed questions, so the JOIN hides them)
router.get('/quizzes', wrap(async (req, res) => {
  const subject = subjectFrom(req);
  const quizzes = await db.query(
    `SELECT q.quiz_id, q.title, q.is_ai_generated, count(*)::int AS questions,
            round(avg(qs.question_rating))::int AS avg_difficulty
     FROM quizzes q
     JOIN quiz_questions qq ON qq.quiz_id = q.quiz_id
     JOIN questions qs ON qs.question_id = qq.question_id
     WHERE q.subject_id = $1
     GROUP BY q.quiz_id
     ORDER BY q.created_at DESC
     LIMIT 24`, [subject]);
  const [mine] = await db.query(
    'SELECT rating FROM user_ratings WHERE user_id = $1 AND subject_id = $2', [req.session.user.user_id, subject]);
  res.render('quizzes', { subjects: await getSubjects(), subject, quizzes, myRating: mine.rating });
}));

// W2: "AI quiz generator" - builds a 10-question quiz around MY rating, then starts it
router.post('/quizzes/generate', wrap(async (req, res) => {
  const me = req.session.user.user_id;
  const subject = subjectFrom(req);
  const attemptId = await db.transaction(async (client) => {
    const { rows: [mine] } = await client.query(
      'SELECT rating FROM user_ratings WHERE user_id = $1 AND subject_id = $2', [me, subject]);
    const { rows: [quiz] } = await client.query(
      `INSERT INTO quizzes (title, subject_id, is_ai_generated, created_by)
       SELECT 'AI Quiz · ' || subject_name || ' · level ' || $2, subject_id, true, $3
       FROM subjects WHERE subject_id = $1
       RETURNING quiz_id`, [subject, mine.rating, me]);
    await client.query(
      `INSERT INTO quiz_questions (quiz_id, position, question_id)
       SELECT $1, row_number() OVER (ORDER BY abs(qs.question_rating - $3), qs.question_id), qs.question_id
       FROM (SELECT qs.question_id, qs.question_rating
             FROM questions qs JOIN topics tp ON tp.topic_id = qs.topic_id
             WHERE tp.subject_id = $2
             ORDER BY abs(qs.question_rating - $3), qs.question_id
             LIMIT 10) qs`, [quiz.quiz_id, subject, mine.rating]);
    const { rows: [attempt] } = await client.query(
      'INSERT INTO quiz_attempts (quiz_id, user_id) VALUES ($1, $2) RETURNING attempt_id', [quiz.quiz_id, me]);
    return attempt.attempt_id;
  });
  res.redirect('/attempts/' + attemptId);
}));

// W3: start a quiz
router.post('/quizzes/:id/start', wrap(async (req, res) => {
  const [attempt] = await db.query(
    'INSERT INTO quiz_attempts (quiz_id, user_id) VALUES ($1, $2) RETURNING attempt_id',
    [req.params.id, req.session.user.user_id]);
  res.redirect('/attempts/' + attempt.attempt_id);
}));

// Play the quiz (R6) or, if it is finished, show the result (R7) and the review (R8)
router.get('/attempts/:id', wrap(async (req, res) => {
  const [attempt] = await db.query(
    `SELECT a.attempt_id, a.quiz_id, a.finished_at, q.title, q.subject_id
     FROM quiz_attempts a JOIN quizzes q ON q.quiz_id = a.quiz_id
     WHERE a.attempt_id = $1 AND a.user_id = $2`, [req.params.id, req.session.user.user_id]);
  if (!attempt) return res.status(404).render('error', { message: 'Quiz attempt not found.' });

  if (!attempt.finished_at) {
    const rows = await db.query(   // R6 (without is_correct!)
      `SELECT qq.position, qs.question_id, qs.question_text, o.option_no, o.option_text
       FROM quiz_questions qq
       JOIN questions qs ON qs.question_id = qq.question_id
       JOIN question_options o ON o.question_id = qs.question_id
       WHERE qq.quiz_id = $1
       ORDER BY qq.position, o.option_no`, [attempt.quiz_id]);
    return res.render('quiz_play', { attempt, questions: groupOptions(rows) });
  }

  const [score] = await db.query(   // R7: the score is computed from the answers, not stored
    `SELECT count(*) FILTER (WHERE o.is_correct)::int AS score, count(*)::int AS answered,
            round(sum(aa.time_taken_ms) / 1000.0)::int AS seconds
     FROM attempt_answers aa
     LEFT JOIN question_options o ON o.question_id = aa.question_id AND o.option_no = aa.chosen_option_no
     WHERE aa.attempt_id = $1`, [attempt.attempt_id]);
  const review = await db.query(    // R8
    `SELECT qq.position, qs.question_text, mine.option_text AS my_answer,
            correct.option_text AS correct_answer, coalesce(mine.is_correct, false) AS was_correct
     FROM attempt_answers aa
     JOIN quiz_attempts a ON a.attempt_id = aa.attempt_id
     JOIN quiz_questions qq ON qq.quiz_id = a.quiz_id AND qq.question_id = aa.question_id
     JOIN questions qs ON qs.question_id = aa.question_id
     LEFT JOIN question_options mine ON mine.question_id = aa.question_id AND mine.option_no = aa.chosen_option_no
     JOIN question_options correct ON correct.question_id = aa.question_id AND correct.is_correct
     WHERE aa.attempt_id = $1
     ORDER BY qq.position`, [attempt.attempt_id]);
  res.render('quiz_result', { attempt, score, review });
}));

// Submit all answers: grade each one (W4 + W5 + W8), then mark the attempt finished
router.post('/attempts/:id/submit', wrap(async (req, res) => {
  const me = req.session.user.user_id;
  const total = await db.transaction(async (client) => {
    const { rows: [attempt] } = await client.query(
      `SELECT attempt_id, quiz_id, started_at FROM quiz_attempts
       WHERE attempt_id = $1 AND user_id = $2 AND finished_at IS NULL FOR UPDATE`, [req.params.id, me]);
    if (!attempt) return null;
    const { rows: questions } = await client.query(
      'SELECT question_id FROM quiz_questions WHERE quiz_id = $1 ORDER BY position', [attempt.quiz_id]);
    const perQuestionMs = (Date.now() - new Date(attempt.started_at).getTime()) / questions.length;

    let change = 0;
    for (const q of questions) {
      const r = await gradeAnswer(client, { userId: me, attemptId: attempt.attempt_id, questionId: q.question_id,
                                            chosen: req.body['q' + q.question_id], timeMs: perQuestionMs });
      change += r.change;
    }
    await client.query('UPDATE quiz_attempts SET finished_at = now() WHERE attempt_id = $1', [attempt.attempt_id]);
    return change;
  });
  if (total !== null) flash(req, total >= 0 ? 'success' : 'error', `Quiz finished. Rating ${total >= 0 ? '+' : ''}${total}.`);
  res.redirect('/attempts/' + req.params.id);
}));

// rows of (question, option) -> [{ position, question_id, question_text, options: [...] }]
function groupOptions(rows) {
  const byId = new Map();
  for (const r of rows) {
    if (!byId.has(r.question_id)) {
      byId.set(r.question_id, { position: r.position, question_id: r.question_id, question_text: r.question_text, options: [] });
    }
    byId.get(r.question_id).options.push({ option_no: r.option_no, option_text: r.option_text });
  }
  return [...byId.values()];
}

module.exports = router;
module.exports.groupOptions = groupOptions;

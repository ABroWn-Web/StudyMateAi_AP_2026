// routes/notebook.js - the AI Mistake Notebook with Leitner-box revision.
// Box 1 = review tomorrow ... box 5 = review in 30 days. Right answer -> next box; wrong -> back to box 1.
const express = require('express');
const db = require('../db');
const { wrap, flash } = require('../lib/helpers');
const router = express.Router();

router.get('/notebook', wrap(async (req, res) => {
  const me = req.session.user.user_id;
  // R13: mistakes due today, with the explanation and the correct answer
  const due = await db.query(
    `SELECT mn.question_id, qs.question_text, correct.option_text AS correct_answer,
            mn.ai_explanation, mn.leitner_box, mn.next_review_on
     FROM mistake_notebook mn
     JOIN questions qs ON qs.question_id = mn.question_id
     JOIN question_options correct ON correct.question_id = mn.question_id AND correct.is_correct
     WHERE mn.user_id = $1 AND mn.next_review_on <= current_date
     ORDER BY mn.next_review_on, mn.leitner_box, mn.question_id
     LIMIT 12`, [me]);
  const boxes = await db.query(
    `SELECT b AS box, count(mn.question_id)::int AS n
     FROM generate_series(1, 5) b
     LEFT JOIN mistake_notebook mn ON mn.leitner_box = b AND mn.user_id = $1
     GROUP BY b ORDER BY b`, [me]);
  const [{ n: dueTotal }] = await db.query(
    'SELECT count(*)::int AS n FROM mistake_notebook WHERE user_id = $1 AND next_review_on <= current_date', [me]);
  res.render('notebook', { due, boxes, dueTotal });
}));

// W9: I remembered it -> move up one box, review later
router.post('/notebook/:qid/remembered', wrap(async (req, res) => {
  await db.query(
    `UPDATE mistake_notebook
     SET leitner_box = least(leitner_box + 1, 5),
         next_review_on = current_date + CASE least(leitner_box + 1, 5)
                                           WHEN 2 THEN 3 WHEN 3 THEN 7 WHEN 4 THEN 14 ELSE 30 END
     WHERE user_id = $1 AND question_id = $2`, [req.session.user.user_id, req.params.qid]);
  flash(req, 'success', 'Nice! Moved up a box.');
  res.redirect('/notebook');
}));

// Forgot it -> back to box 1, review tomorrow
router.post('/notebook/:qid/forgot', wrap(async (req, res) => {
  await db.query(
    'UPDATE mistake_notebook SET leitner_box = 1, next_review_on = current_date + 1 WHERE user_id = $1 AND question_id = $2',
    [req.session.user.user_id, req.params.qid]);
  flash(req, 'error', 'Back to box 1. You will see it again tomorrow.');
  res.redirect('/notebook');
}));

module.exports = router;

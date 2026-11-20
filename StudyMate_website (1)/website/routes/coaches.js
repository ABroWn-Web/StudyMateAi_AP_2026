// routes/coaches.js - pick a coach (a top student who coaches ONE subject).
const express = require('express');
const db = require('../db');
const { wrap, getSubjects, subjectFrom, flash } = require('../lib/helpers');
const router = express.Router();

router.get('/coaches', wrap(async (req, res) => {
  const me = req.session.user.user_id;
  const subject = subjectFrom(req);
  const coaches = await db.query(   // R17
    `SELECT co.coach_id, u.username, u.full_name, ur.rating, count(ch.student_id)::int AS students,
            bool_or(ch.student_id = $2) AS is_mine
     FROM coaches co
     JOIN users u ON u.user_id = co.coach_id
     JOIN user_ratings ur ON ur.user_id = co.coach_id AND ur.subject_id = co.subject_id
     LEFT JOIN coaching ch ON ch.coach_id = co.coach_id
     WHERE co.subject_id = $1
     GROUP BY co.coach_id, u.username, u.full_name, ur.rating
     ORDER BY ur.rating DESC, co.coach_id`, [subject, me]);
  const myCoaches = await db.query(
    `SELECT s.subject_name, u.username FROM coaching ch
     JOIN coaches co ON co.coach_id = ch.coach_id
     JOIN subjects s ON s.subject_id = co.subject_id
     JOIN users u ON u.user_id = co.coach_id
     WHERE ch.student_id = $1 ORDER BY s.subject_id`, [me]);
  res.render('coaches', { subjects: await getSubjects(), subject, coaches, myCoaches });
}));

// W12: join a coach. The database trigger refuses a 2nd coach in the same subject.
router.post('/coaches/:id/join', wrap(async (req, res) => {
  try {
    await db.query('INSERT INTO coaching (student_id, coach_id) VALUES ($1, $2)', [req.session.user.user_id, req.params.id]);
    flash(req, 'success', 'Coach added!');
  } catch (err) {
    if (err.code === 'P0001') flash(req, 'error', 'You already have a coach for this subject.');   // from our trigger
    else if (err.code === '23505') flash(req, 'error', 'This is already your coach.');
    else throw err;
  }
  res.redirect('back');
}));

router.post('/coaches/:id/leave', wrap(async (req, res) => {
  await db.query('DELETE FROM coaching WHERE student_id = $1 AND coach_id = $2', [req.session.user.user_id, req.params.id]);
  flash(req, 'success', 'Coach removed.');
  res.redirect('back');
}));

module.exports = router;

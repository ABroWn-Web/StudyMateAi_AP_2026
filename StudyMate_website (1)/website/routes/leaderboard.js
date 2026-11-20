// routes/leaderboard.js - top students (R3) and top colleges (R4) per subject.
const express = require('express');
const db = require('../db');
const { wrap, getSubjects, subjectFrom } = require('../lib/helpers');
const router = express.Router();

router.get('/leaderboard', wrap(async (req, res) => {
  const subject = subjectFrom(req);
  const students = await db.query(   // R3
    `SELECT u.user_id, u.username, c.college_name, ur.rating, t.title_code
     FROM user_ratings ur
     JOIN users u ON u.user_id = ur.user_id
     LEFT JOIN colleges c ON c.college_id = u.college_id
     CROSS JOIN LATERAL (SELECT title_code FROM titles WHERE min_rating <= ur.rating
                         ORDER BY min_rating DESC LIMIT 1) t
     WHERE ur.subject_id = $1
     ORDER BY ur.rating DESC, u.user_id
     LIMIT 20`, [subject]);
  const colleges = await db.query(   // R4
    `SELECT c.college_name, c.city, count(*)::int AS students, round(avg(ur.rating))::int AS avg_rating
     FROM colleges c
     JOIN users u ON u.college_id = c.college_id
     JOIN user_ratings ur ON ur.user_id = u.user_id AND ur.subject_id = $1
     GROUP BY c.college_id, c.college_name, c.city
     HAVING count(*) >= 20
     ORDER BY avg_rating DESC, c.college_id
     LIMIT 10`, [subject]);
  const [me] = await db.query(   // my rank = 1 + number of students rated above me
    `SELECT mine.rating, 1 + (SELECT count(*) FROM user_ratings o
                              WHERE o.subject_id = mine.subject_id AND o.rating > mine.rating)::int AS rank
     FROM user_ratings mine WHERE mine.user_id = $1 AND mine.subject_id = $2`, [req.session.user.user_id, subject]);
  res.render('leaderboard', { subjects: await getSubjects(), subject, students, colleges, me });
}));

module.exports = router;

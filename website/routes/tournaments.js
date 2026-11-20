// routes/tournaments.js - the Tournaments page (coming soon).
const express = require('express');
const db = require('../db');
const tournaments = require('../lib/tournaments');
const { wrap } = require('../lib/helpers');
const router = express.Router();

router.get('/tournaments', wrap(async (req, res) => {
  // The sponsors are the top 10 universities on StudyMate: best average rating of their students
  const sponsors = await db.query(
    `SELECT c.college_id, c.college_name, c.city,
            round(avg(ur.rating))::int AS avg_rating, count(DISTINCT u.user_id)::int AS students
     FROM colleges c
     JOIN users u ON u.college_id = c.college_id
     JOIN user_ratings ur ON ur.user_id = u.user_id
     GROUP BY c.college_id, c.college_name, c.city
     ORDER BY avg_rating DESC, c.college_id
     LIMIT 10`);
  res.render('tournaments', { tournaments, sponsors });
}));

module.exports = router;

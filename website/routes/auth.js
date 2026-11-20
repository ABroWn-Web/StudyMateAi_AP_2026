// routes/auth.js - sign up, log in, log out.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { wrap, flash } = require('../lib/helpers');
const router = express.Router();

router.get('/', (req, res) => res.redirect(req.session.user ? '/study' : '/login'));

router.get('/login', (req, res) => res.render('login'));

// R1: find the account by email, then compare the password with the stored hash.
router.post('/login', wrap(async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const rows = await db.query(
    'SELECT user_id, username, full_name, password_hash FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(req.body.password || '', user.password_hash)) {
    flash(req, 'error', 'Wrong email or password.');
    return res.redirect('/login');
  }
  req.session.user = { user_id: user.user_id, username: user.username, full_name: user.full_name };
  res.redirect('/study');
}));

router.get('/signup', wrap(async (req, res) => {
  const colleges = await db.query('SELECT college_id, college_name, city FROM colleges ORDER BY college_name');
  res.render('signup', { colleges });
}));

// W1: create the user AND a starting rating of 1200 in every subject (one SQL statement).
router.post('/signup', wrap(async (req, res) => {
  const { username, email, full_name, password, college_id } = req.body;
  if (!password || password.length < 6) {
    flash(req, 'error', 'Password must be at least 6 characters.');
    return res.redirect('/signup');
  }
  try {
    const rows = await db.query(
      `WITH new_user AS (
         INSERT INTO users (username, email, full_name, password_hash, college_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING user_id, username, full_name
       ), ratings AS (
         INSERT INTO user_ratings (user_id, subject_id)
         SELECT new_user.user_id, s.subject_id FROM new_user CROSS JOIN subjects s
       )
       SELECT * FROM new_user`,
      [username.trim().toLowerCase(), email.trim().toLowerCase(), full_name.trim(),
       bcrypt.hashSync(password, 10), college_id || null]);
    req.session.user = rows[0];
    flash(req, 'success', `Welcome, ${rows[0].full_name}! You start at 1200 in every subject.`);
    res.redirect('/dashboard');
  } catch (err) {
    // 23505 = UNIQUE violation, 23514 = CHECK violation (see dbms/03_schema.sql)
    if (err.code === '23505') flash(req, 'error', 'That username or email is already taken.');
    else if (err.code === '23514') flash(req, 'error', 'Username: 3-30 lowercase letters, digits or _. Email must be valid.');
    else throw err;
    res.redirect('/signup');
  }
}));

router.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

module.exports = router;

// lib/helpers.js - small helpers used by every route.
const db = require('../db');

// Express 4 does not catch errors thrown inside async functions.
// wrap() catches them and passes them to the error page.
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Middleware: only logged-in users may continue, everyone else goes to /login.
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// The 6 subjects never change, so we read them once and remember them.
let subjectsCache = null;
async function getSubjects() {
  if (!subjectsCache) subjectsCache = await db.query('SELECT subject_id, subject_name FROM subjects ORDER BY subject_id');
  return subjectsCache;
}

// ?subject=3 in the URL -> 3 (default: 1 = Physics)
function subjectFrom(req) {
  const id = parseInt(req.query.subject || req.body.subject, 10);
  return id >= 1 && id <= 6 ? id : 1;
}

// A short message shown once on the next page (e.g. "Correct! +12").
function flash(req, type, text) {
  req.session.flash = { type, text };
}

module.exports = { wrap, requireLogin, getSubjects, subjectFrom, flash };

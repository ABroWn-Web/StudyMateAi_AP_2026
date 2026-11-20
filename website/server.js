// server.js - starts the website.  Run:  npm start  ->  open http://localhost:3000
const express = require('express');
const session = require('express-session');
const path = require('path');
const { requireLogin } = require('./lib/helpers');

const app = express();

// FRONTEND: pages are EJS templates in /views (HTML + <%= values %>),
// and /public holds the CSS and the small browser scripts.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Read data sent by <form method="POST"> into req.body
app.use(express.urlencoded({ extended: true }));

// Sessions: remember who is logged in (a cookie holds the session id).
app.use(session({ secret: 'studymate-ai-secret', resave: false, saveUninitialized: false }));

// Values every page can use: the logged-in user, a one-time message, the current URL.
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.path = req.path;
  next();
});

// BACKEND: each file in /routes handles one feature (URL -> SQL -> page).
app.use(require('./routes/auth'));          // /login, /signup, /logout (open to everyone)
app.use(requireLogin);                       // everything below needs a login
app.use(require('./routes/study'));         // /study      (Study Workspace: notes -> summary, flashcards, quiz)
app.use(require('./routes/dashboard'));     // /dashboard
app.use(require('./routes/practice'));      // /practice   (adaptive Elo practice)
app.use(require('./routes/quizzes'));       // /quizzes, /attempts/:id
app.use(require('./routes/duels'));         // /duels      (chess-clock duels)
app.use(require('./routes/notebook'));      // /notebook   (AI Mistake Notebook)
app.use(require('./routes/focus'));         // /focus      (Pomodoro + chess puzzle)
app.use(require('./routes/leaderboard'));   // /leaderboard
app.use(require('./routes/coaches'));       // /coaches

// Unknown URL -> 404 page; any error -> error page (instead of crashing).
app.use((req, res) => res.status(404).render('error', { message: 'Page not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: 'Something went wrong: ' + err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`StudyMate AI running at http://localhost:${PORT}`));

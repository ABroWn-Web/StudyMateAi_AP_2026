// routes/study.js - the Study Workspace: paste notes (or pick a sample) ->
// summary, key concepts, flashcards, a practice quiz and a step-by-step teacher panel.
const express = require('express');
const { analyze, highlight } = require('../lib/studyEngine');
const samples = require('../lib/samples');
const { wrap, flash } = require('../lib/helpers');
const router = express.Router();

// Save the notes in this session's history (newest first, max 6), then show them
function remember(req, title, text) {
  const history = (req.session.history || []).filter((h) => h.title !== title);
  history.unshift({ title, text, at: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) });
  req.session.history = history.slice(0, 6);
}

router.get('/study', wrap(async (req, res) => {
  const history = req.session.history || [];
  let current = null;
  if (req.query.sample && samples[req.query.sample]) {          // ?sample=photosynthesis
    const s = samples[req.query.sample];
    remember(req, s.title, s.text);
    return res.redirect('/study?h=0');
  }
  if (req.query.h !== undefined && history[req.query.h]) current = history[req.query.h];   // ?h=0 = newest
  const result = current ? analyze(current.text) : null;
  const sample = current && Object.values(samples).find((s) => s.title === current.title);
  res.render('study', { samples, history: req.session.history || [], current, result, highlight,
                        subjectId: sample ? sample.subjectId : null });
}));

router.post('/study', (req, res) => {
  const text = (req.body.text || '').trim();
  if (text.split(/[.!?]/).filter((s) => s.trim().split(' ').length >= 5).length < 3) {
    flash(req, 'error', 'Paste at least 3 full sentences of notes.');
    return res.redirect('/study');
  }
  const title = text.split(/\s+/).slice(0, 5).join(' ') + '…';
  remember(req, title, text);
  res.redirect('/study?h=0');
});

module.exports = router;

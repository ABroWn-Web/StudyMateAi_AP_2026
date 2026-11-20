// lib/studyEngine.js - turns pasted notes into study material.
// No paid AI service: five simple, explainable rules.
//   1. Key concepts = the words / two-word phrases that repeat most (ignoring filler words)
//   2. Summary      = the 3 sentences that contain the most key-concept words
//   3. Flashcards   = a sentence with the concept blanked out (front) + the concept (back)
//   4. Quiz         = the same blank, with the right concept and 3 other concepts as options
//   5. Teacher mode = every sentence that mentions a concept, as numbered steps

// Filler words and common verbs that never count as concepts
const STOPWORDS = new Set(`a an the and or but if so of to in on at by for with from as is are was were be been being
it its this that these those which who what when where why how such into over under than also can could would should
will may might must do does did has have had not no only very just about after before between both each more most other
some there their them they up while you your we our he she his her one two three called means mainly usually often
example together like use used using make makes made take takes place keep keeps done gives get way part states state
forms form becomes become describes describe shows show change changes acts needs works help helps build joins replaces
names ends depends contains absorbs carried converts released measured pushes push opposes transfers loses gains share
shares request responds stores encrypts translates forward isolate checked substituting cross represents tells written
equals accelerates resist produces travels arrive put stays happens tiny small large larger new same right whatever`.split(/\s+/));

function splitSentences(text) {
  return text.replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)                     // split after . ! or ?
    .map((s) => s.trim())
    .filter((s) => s.split(' ').length >= 5);   // ignore tiny fragments
}

function wordsOf(sentence) {
  return (sentence.toLowerCase().match(/[a-z][a-z'-]*/g) || []);
}

const isContent = (w) => w.length > 2 && !STOPWORDS.has(w);

// Rule 1: key concepts
//  - count every word and two-word phrase ("bonds" counts as "bond")
//  - a term that a sentence DEFINES ("A noun is ...", "Inertia is ...") gets a big bonus
function findConcepts(sentences, howMany = 8) {
  const allWords = new Set(sentences.flatMap(wordsOf));
  const singular = (w) => (w.endsWith('s') && allWords.has(w.slice(0, -1)) ? w.slice(0, -1) : w);
  const scores = new Map();
  const add = (term, points) => scores.set(term, (scores.get(term) || 0) + points);

  for (const s of sentences) {
    const words = wordsOf(s).map(singular);
    words.forEach((w, i) => {
      if (!isContent(w)) return;
      add(w, 1);
      const next = words[i + 1];
      if (next && isContent(next)) add(w + ' ' + next, 1.5);           // phrases count a bit more
    });
    const defined = s.match(/^(?:an?|the)?\s*([a-z'-]+(?: [a-z'-]+)?) (?:is|are|means)\b/i);
    if (defined) {
      const term = wordsOf(defined[1]).map(singular).filter(isContent).join(' ');
      if (term) add(term, 4);                                            // "X is ..." = a definition
    }
  }
  const ranked = [...scores].filter(([term, n]) => n >= 2 && (term.includes(' ') ? n >= 3 : true))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const concepts = [];
  for (const [term, score] of ranked) {
    // skip "bond" if "ionic bond" is already chosen (and the other way round)
    const overlaps = concepts.some((c) => c.term.split(' ').some((w) => term.split(' ').includes(w)));
    if (!overlaps) concepts.push({ term, count: Math.round(score) });
    if (concepts.length === howMany) break;
  }
  return concepts;
}

// Does the sentence mention the concept (as whole words)?
function mentions(sentence, term) {
  return new RegExp(`\\b${term}s?\\b`, 'i').test(sentence);
}

// Rule 2: the summary = top 3 sentences by how many concept words they contain (kept in order)
function summarize(sentences, concepts) {
  const scored = sentences.map((s, i) => ({
    s, i, score: concepts.filter((c) => mentions(s, c.term)).length + (i === 0 ? 1 : 0),   // first sentence usually defines the topic
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).sort((a, b) => a.i - b.i).map((x) => x.s);
}

// The best sentence to learn a concept from: a definition ("X is ...") if there is one
function bestSentence(sentences, term) {
  const about = sentences.filter((s) => mentions(s, term));
  return about.find((s) => new RegExp(`\\b${term}s?\\b (is|are|means)\\b`, 'i').test(s)) || about[0];
}

function blankOut(sentence, term) {
  return sentence.replace(new RegExp(`\\b${term}s?\\b`, 'gi'), '______');
}

// Rule 3: flashcards
function makeFlashcards(sentences, concepts) {
  return concepts.slice(0, 6).map((c) => ({ front: blankOut(bestSentence(sentences, c.term), c.term), back: c.term }));
}

// Rule 4: multiple-choice quiz (the right answer + 3 other concepts)
function makeQuiz(sentences, concepts) {
  const terms = concepts.map((c) => c.term);
  return concepts.slice(0, 5).map((c, i) => {
    const source = bestSentence(sentences, c.term);
    const wrong = terms.filter((t) => t !== c.term).slice(i % 3, (i % 3) + 3);
    const list = [c.term, ...wrong];
    const shift = i % list.length;                      // rotate, so the answer is not always first
    const options = [...list.slice(shift), ...list.slice(0, shift)];
    return { question: blankOut(source, c.term), options, answer: c.term, explanation: source };
  });
}

// Rule 5: "explain like a teacher" - each concept as numbered steps from the notes
function makeTeacherSteps(sentences, concepts) {
  return concepts.map((c) => ({
    term: c.term,
    steps: sentences.filter((s) => mentions(s, c.term)).slice(0, 5),
  }));
}

// Everything at once
function analyze(text) {
  const sentences = splitSentences(text);
  const concepts = findConcepts(sentences);
  return {
    sentenceCount: sentences.length,
    wordCount: wordsOf(text).length,
    summary: summarize(sentences, concepts),
    concepts,
    flashcards: makeFlashcards(sentences, concepts),
    quiz: makeQuiz(sentences, concepts),
    teacher: makeTeacherSteps(sentences, concepts),
  };
}

// Safe HTML: escape the user's text (so pasted <script> can't run), then wrap concepts in <mark>
function highlight(sentence, terms) {
  const safe = sentence.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const list = [].concat(terms || []).filter(Boolean);
  if (!list.length) return safe;
  return safe.replace(new RegExp(`\\b(${list.join('|')})s?\\b`, 'gi'), '<mark>$&</mark>');
}

module.exports = { analyze, highlight, splitSentences };

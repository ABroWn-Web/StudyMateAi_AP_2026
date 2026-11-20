// public/study.js - runs in the BROWSER on the Study Workspace.
// 1. mode switcher  2. flip flashcards  3. instant quiz scoring  4. teacher panel

// 1. show only the chosen mode (Summary / Key concepts / Flashcards / Quiz)
document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b === button));
    document.querySelectorAll('.mode').forEach((m) => m.classList.toggle('hidden', m.id !== 'mode-' + button.dataset.mode));
  });
});

// 2. click a flashcard to flip it (the CSS does the turning animation)
document.querySelectorAll('.flashcard').forEach((card) => {
  card.addEventListener('click', () => card.classList.toggle('flipped'));
});

// 3. quiz: one try per question, then show right/wrong + the sentence from the notes
const questions = document.querySelectorAll('.qcard');
let score = 0;
let answered = 0;
questions.forEach((q) => {
  q.querySelectorAll('.choice').forEach((choice) => {
    choice.addEventListener('click', () => {
      if (q.dataset.done) return;                       // already answered
      q.dataset.done = 'yes';
      answered++;
      const right = choice.dataset.option === q.dataset.answer;
      if (right) score++;
      choice.classList.add(right ? 'correct' : 'wrong');
      q.querySelectorAll('.choice').forEach((c) => {    // always reveal the right answer
        if (c.dataset.option === q.dataset.answer) c.classList.add('correct');
      });
      q.querySelector('.qexplain').classList.remove('hidden');
      document.getElementById('score').textContent = score + ' / ' + questions.length;
      if (answered === questions.length) {
        document.getElementById('verdict').textContent =
          score === questions.length ? 'Perfect!' : score >= questions.length / 2 ? 'Good work.' : 'Review the flashcards and try again.';
      }
    });
  });
});

// 4. click a concept (anywhere) to explain it step by step in the right-hand panel
document.querySelectorAll('[data-concept]').forEach((chip) => {
  chip.addEventListener('click', () => {
    const term = chip.dataset.concept;
    document.querySelectorAll('[data-concept]').forEach((c) => c.classList.toggle('active', c.dataset.concept === term));
    document.querySelectorAll('.teach').forEach((t) => t.classList.toggle('hidden', t.dataset.term !== term));
  });
});

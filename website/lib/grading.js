// lib/grading.js - what happens when a student answers ONE question.
// Used by adaptive practice and by quizzes. Runs inside a transaction (client).
const { ratingChange } = require('./elo');

async function gradeAnswer(client, { userId, attemptId, questionId, chosen, timeMs }) {
  // The question, its subject, and its correct option
  const { rows: [q] } = await client.query(
    `SELECT qs.question_id, qs.question_text, qs.question_rating, tp.subject_id, tp.topic_name,
            o.option_no AS correct_no, o.option_text AS correct_text
     FROM questions qs
     JOIN topics tp ON tp.topic_id = qs.topic_id
     JOIN question_options o ON o.question_id = qs.question_id AND o.is_correct
     WHERE qs.question_id = $1`, [questionId]);

  const chosenNo = chosen ? parseInt(chosen, 10) : null;      // null = skipped
  const correct = chosenNo === q.correct_no;

  // W4: save the answer
  await client.query(
    `INSERT INTO attempt_answers (attempt_id, question_id, chosen_option_no, time_taken_ms)
     VALUES ($1, $2, $3, $4)`, [attemptId, questionId, chosenNo, Math.max(0, Math.round(timeMs))]);

  // W5: Elo update - I "played" the question. Win = correct.
  const { rows: [me] } = await client.query(
    'SELECT rating FROM user_ratings WHERE user_id = $1 AND subject_id = $2 FOR UPDATE',
    [userId, q.subject_id]);
  const change = ratingChange(me.rating, q.question_rating, correct ? 1 : 0);
  await client.query(
    `UPDATE user_ratings SET rating = greatest(100, least(3500, rating + $3)), updated_at = now()
     WHERE user_id = $1 AND subject_id = $2`, [userId, q.subject_id, change]);
  await client.query(  // the question moves the opposite way
    'UPDATE questions SET question_rating = greatest(100, least(3500, question_rating - $2)) WHERE question_id = $1',
    [questionId, change]);

  // W8: wrong or skipped -> into the Mistake Notebook with an explanation, review tomorrow
  let chosenText = null;
  if (!correct) {
    if (chosenNo) {
      const { rows } = await client.query(
        'SELECT option_text FROM question_options WHERE question_id = $1 AND option_no = $2', [questionId, chosenNo]);
      chosenText = rows[0] && rows[0].option_text;
    }
    const explanation = explain(q, chosenText);
    await client.query(
      `INSERT INTO mistake_notebook (user_id, question_id, ai_explanation, leitner_box, next_review_on)
       VALUES ($1, $2, $3, 1, current_date + 1)
       ON CONFLICT (user_id, question_id)
       DO UPDATE SET ai_explanation = EXCLUDED.ai_explanation, leitner_box = 1, next_review_on = current_date + 1`,
      [userId, questionId, explanation]);
  }

  return { correct, change, newRating: me.rating + change, correctText: q.correct_text,
           chosenText, questionText: q.question_text, subjectId: q.subject_id };
}

// The "AI explanation". Here it is built from a template; this is the one place
// where a real AI model (an LLM API call) could be plugged in later.
function explain(q, chosenText) {
  const picked = chosenText ? `You picked "${chosenText}"` : 'You skipped this question';
  return `${picked}, but the correct answer is "${q.correct_text}". `
    + `This is a ${q.topic_name} question rated ${q.question_rating}. `
    + 'Revise the idea behind the correct option, then try it again tomorrow.';
}

module.exports = { gradeAnswer };

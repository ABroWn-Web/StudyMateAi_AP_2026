-- =====================================================================
-- StudyMate AI: every SQL query the app uses (AP CP3)
--   R1-R18 : READ  queries (18)
--   W1-W12 : WRITE queries (12)
--
-- Each query is marked "-- READ" or "-- WRITE", has an id, and says which
-- screen of the website uses it. Values like user 42 / subject 1 (Physics)
-- stand for the app's parameters (the logged-in user, the chosen subject...).
--
-- Run (safe: everything is inside BEGIN ... ROLLBACK, nothing is saved):
--   psql -d studymate -f dbms/03_schema.sql
--   psql -d studymate -f dbms/seed_data.sql      (test data)
--   psql -d studymate -f dbms/04_queries.sql
-- =====================================================================
SET search_path TO studymate;
BEGIN;

-- @R1
-- READ  R1 · Login screen: find the account by email (then the app checks the password hash)
SELECT user_id, username, full_name, password_hash
FROM users
WHERE email = 'user00042@studymate.app';

-- @R2
-- READ  R2 · Dashboard: my profile, college, and my chess-style rating + title in every subject
SELECT u.username, u.full_name, c.college_name, s.subject_name, ur.rating, t.title_name
FROM users u
LEFT JOIN colleges c     ON c.college_id = u.college_id
JOIN user_ratings ur     ON ur.user_id = u.user_id
JOIN subjects s          ON s.subject_id = ur.subject_id
CROSS JOIN LATERAL (SELECT title_name FROM titles
                    WHERE min_rating <= ur.rating
                    ORDER BY min_rating DESC LIMIT 1) t
WHERE u.user_id = 42
ORDER BY ur.rating DESC;

-- @R3
-- READ  R3 · Leaderboard: top 20 students in Physics, with college and title
SELECT u.username, c.college_name, ur.rating, t.title_code
FROM user_ratings ur
JOIN users u         ON u.user_id = ur.user_id
LEFT JOIN colleges c ON c.college_id = u.college_id
CROSS JOIN LATERAL (SELECT title_code FROM titles
                    WHERE min_rating <= ur.rating
                    ORDER BY min_rating DESC LIMIT 1) t
WHERE ur.subject_id = 1
ORDER BY ur.rating DESC, u.user_id
LIMIT 20;

-- @R4
-- READ  R4 · Leaderboard (colleges tab): colleges ranked by their students' average Physics rating
SELECT c.college_name, c.city, count(*) AS students, round(avg(ur.rating)) AS avg_rating
FROM colleges c
JOIN users u         ON u.college_id = c.college_id
JOIN user_ratings ur ON ur.user_id = u.user_id AND ur.subject_id = 1
GROUP BY c.college_id, c.college_name, c.city
HAVING count(*) >= 20
ORDER BY avg_rating DESC, c.college_id
LIMIT 10;

-- @R5
-- READ  R5 · Quiz library: newest Physics quizzes with number of questions and average difficulty
SELECT q.quiz_id, q.title, q.is_ai_generated,
       count(*) AS questions, round(avg(qs.question_rating)) AS avg_difficulty
FROM quizzes q
JOIN quiz_questions qq ON qq.quiz_id = q.quiz_id
JOIN questions qs      ON qs.question_id = qq.question_id
WHERE q.subject_id = 1
GROUP BY q.quiz_id
ORDER BY q.created_at DESC
LIMIT 20;

-- @R6
-- READ  R6 · Play quiz: the questions of quiz 77 in order, with their options
-- (is_correct is NOT sent to the browser, so nobody can cheat)
SELECT qq.position, qs.question_id, qs.question_text, o.option_no, o.option_text
FROM quiz_questions qq
JOIN questions qs        ON qs.question_id = qq.question_id
JOIN question_options o  ON o.question_id = qs.question_id
WHERE qq.quiz_id = 77
ORDER BY qq.position, o.option_no;

-- @R7
-- READ  R7 · Result screen: score of attempt 1001 (the score is computed, not stored)
SELECT a.attempt_id, u.username, q.title,
       count(*) FILTER (WHERE o.is_correct) AS score,
       count(*) AS answered,
       round(sum(aa.time_taken_ms) / 1000.0, 1) AS seconds
FROM quiz_attempts a
JOIN users u              ON u.user_id = a.user_id
JOIN quizzes q            ON q.quiz_id = a.quiz_id
JOIN attempt_answers aa   ON aa.attempt_id = a.attempt_id
LEFT JOIN question_options o ON o.question_id = aa.question_id AND o.option_no = aa.chosen_option_no
WHERE a.attempt_id = 1001
GROUP BY a.attempt_id, u.username, q.title;

-- @R8
-- READ  R8 · Review answers: each question of attempt 1001, my answer and the correct answer
SELECT qq.position, qs.question_text,
       mine.option_text AS my_answer, correct.option_text AS correct_answer,
       coalesce(mine.is_correct, false) AS was_correct
FROM attempt_answers aa
JOIN quiz_attempts a          ON a.attempt_id = aa.attempt_id
JOIN quiz_questions qq        ON qq.quiz_id = a.quiz_id AND qq.question_id = aa.question_id
JOIN questions qs             ON qs.question_id = aa.question_id
LEFT JOIN question_options mine ON mine.question_id = aa.question_id AND mine.option_no = aa.chosen_option_no
JOIN question_options correct ON correct.question_id = aa.question_id AND correct.is_correct
WHERE aa.attempt_id = 1001
ORDER BY qq.position;

-- @R9
-- READ  R9 · Find a duel: the 5 opponents closest to my Physics rating (within +-100), like chess matchmaking
SELECT u.user_id, u.username, other.rating, abs(other.rating - me.rating) AS rating_gap
FROM user_ratings me
JOIN user_ratings other ON other.subject_id = me.subject_id
                       AND other.user_id <> me.user_id
                       AND other.rating BETWEEN me.rating - 100 AND me.rating + 100
JOIN users u            ON u.user_id = other.user_id
WHERE me.user_id = 42 AND me.subject_id = 1
ORDER BY rating_gap, u.user_id
LIMIT 5;

-- @R10
-- READ  R10 · Duel scoresheet: duel 501, White and Black with score, rating change, result and clock
SELECT dp.color, u.username, dp.rating_before, dp.rating_change,
       count(o.option_no) FILTER (WHERE o.is_correct) AS score,
       d.result, d.termination, d.base_seconds, d.increment_seconds
FROM duels d
JOIN duel_players dp          ON dp.duel_id = d.duel_id
JOIN quiz_attempts a          ON a.attempt_id = dp.attempt_id
JOIN users u                  ON u.user_id = a.user_id
LEFT JOIN attempt_answers aa  ON aa.attempt_id = a.attempt_id
LEFT JOIN question_options o  ON o.question_id = aa.question_id AND o.option_no = aa.chosen_option_no
WHERE d.duel_id = 501
GROUP BY dp.color, u.username, dp.rating_before, dp.rating_change,
         d.result, d.termination, d.base_seconds, d.increment_seconds
ORDER BY dp.color DESC;                       -- WHITE first

-- @R11
-- READ  R11 · My duels: my last 10 finished duels, with my colour, the opponent and my rating change
SELECT d.duel_id, d.ended_at, me.color, opp_user.username AS opponent, d.result, me.rating_change
FROM quiz_attempts my_attempt
JOIN duel_players me          ON me.attempt_id = my_attempt.attempt_id
JOIN duels d                  ON d.duel_id = me.duel_id
JOIN duel_players opp         ON opp.duel_id = d.duel_id AND opp.color <> me.color
JOIN quiz_attempts opp_attempt ON opp_attempt.attempt_id = opp.attempt_id
JOIN users opp_user           ON opp_user.user_id = opp_attempt.user_id
WHERE my_attempt.user_id = 42 AND d.ended_at IS NOT NULL
ORDER BY d.ended_at DESC
LIMIT 10;

-- @R12
-- READ  R12 · Adaptive practice ("every question is an opponent"): the Physics question I have
-- never answered whose Elo rating is closest to mine
SELECT qs.question_id, qs.question_text, qs.question_rating
FROM user_ratings ur
JOIN topics tp     ON tp.subject_id = ur.subject_id
JOIN questions qs  ON qs.topic_id = tp.topic_id
WHERE ur.user_id = 42 AND ur.subject_id = 1
  AND NOT EXISTS (SELECT 1
                  FROM attempt_answers aa
                  JOIN quiz_attempts a ON a.attempt_id = aa.attempt_id
                  WHERE a.user_id = ur.user_id AND aa.question_id = qs.question_id)
ORDER BY abs(qs.question_rating - ur.rating), qs.question_id
LIMIT 1;

-- @R13
-- READ  R13 · Mistake Notebook: my mistakes due for revision today, with the AI explanation and the right answer
SELECT mn.question_id, qs.question_text, correct.option_text AS correct_answer,
       mn.ai_explanation, mn.leitner_box, mn.next_review_on
FROM mistake_notebook mn
JOIN questions qs             ON qs.question_id = mn.question_id
JOIN question_options correct ON correct.question_id = mn.question_id AND correct.is_correct
WHERE mn.user_id = 42 AND mn.next_review_on <= current_date
ORDER BY mn.next_review_on, mn.leitner_box, mn.question_id;

-- @R14
-- READ  R14 · My weak topics: my accuracy per topic over the last 30 days, weakest first
SELECT tp.topic_name, count(*) AS answered,
       round(100.0 * count(*) FILTER (WHERE o.is_correct) / count(*), 1) AS accuracy_pct
FROM quiz_attempts a
JOIN attempt_answers aa      ON aa.attempt_id = a.attempt_id
JOIN questions qs            ON qs.question_id = aa.question_id
JOIN topics tp               ON tp.topic_id = qs.topic_id
LEFT JOIN question_options o ON o.question_id = aa.question_id AND o.option_no = aa.chosen_option_no
WHERE a.user_id = 42 AND a.started_at >= now() - interval '30 days'
GROUP BY tp.topic_id, tp.topic_name
ORDER BY accuracy_pct, answered DESC;

-- @R15
-- READ  R15 · Focus stats: my study minutes and chess puzzles solved per subject this week
SELECT s.subject_name, count(*) AS sessions,
       round(sum(EXTRACT(EPOCH FROM (ss.ended_at - ss.started_at))) / 60) AS focus_minutes,
       count(*) FILTER (WHERE ss.puzzle_solved) AS puzzles_solved
FROM study_sessions ss
JOIN subjects s ON s.subject_id = ss.subject_id
WHERE ss.user_id = 42
  AND ss.started_at >= now() - interval '7 days'
  AND ss.ended_at IS NOT NULL
GROUP BY s.subject_name
ORDER BY focus_minutes DESC;

-- @R16
-- READ  R16 · Brain break: a chess puzzle I have not seen yet, closest to my average rating
SELECT p.puzzle_id, p.fen, p.theme, p.puzzle_rating
FROM chess_puzzles p
WHERE NOT EXISTS (SELECT 1 FROM study_sessions ss
                  WHERE ss.user_id = 42 AND ss.puzzle_id = p.puzzle_id)
ORDER BY abs(p.puzzle_rating - (SELECT avg(rating) FROM user_ratings WHERE user_id = 42)), p.puzzle_id
LIMIT 1;

-- @R17
-- READ  R17 · Coaches page: Maths coaches with their Maths rating and number of students
SELECT co.coach_id, u.username, ur.rating, count(ch.student_id) AS students
FROM coaches co
JOIN users u         ON u.user_id = co.coach_id
JOIN user_ratings ur ON ur.user_id = co.coach_id AND ur.subject_id = co.subject_id
LEFT JOIN coaching ch ON ch.coach_id = co.coach_id
WHERE co.subject_id = 3
GROUP BY co.coach_id, u.username, ur.rating
ORDER BY ur.rating DESC, co.coach_id;

-- @R18
-- READ  R18 · Teacher report: the 20 hardest Physics questions (lowest accuracy, at least 30 answers)
SELECT qs.question_id, qs.question_text, qs.question_rating, count(*) AS answers,
       round(100.0 * count(*) FILTER (WHERE o.is_correct) / count(*), 1) AS accuracy_pct
FROM questions qs
JOIN topics tp               ON tp.topic_id = qs.topic_id
JOIN attempt_answers aa      ON aa.question_id = qs.question_id
LEFT JOIN question_options o ON o.question_id = aa.question_id AND o.option_no = aa.chosen_option_no
WHERE tp.subject_id = 1
GROUP BY qs.question_id
HAVING count(*) >= 30
ORDER BY accuracy_pct, qs.question_id
LIMIT 20;

-- @W1
-- WRITE W1 · Sign up: create the account AND give it a starting rating of 1200 in every subject
WITH new_user AS (
    INSERT INTO users (username, email, full_name, password_hash, college_id)
    VALUES ('new_student', 'new.student@studymate.app', 'New Student', md5('demo-only'), 7)
    RETURNING user_id
)
INSERT INTO user_ratings (user_id, subject_id)
SELECT new_user.user_id, s.subject_id
FROM new_user CROSS JOIN subjects s;

-- @W2
-- WRITE W2 · AI quiz generator: create a Physics quiz of the 10 questions closest to rating 1500
WITH new_quiz AS (
    INSERT INTO quizzes (title, subject_id, is_ai_generated)
    VALUES ('AI Physics Challenge (1500)', 1, true)
    RETURNING quiz_id
),
picked AS (
    SELECT qs.question_id, row_number() OVER (ORDER BY abs(qs.question_rating - 1500), qs.question_id) AS position
    FROM questions qs JOIN topics tp ON tp.topic_id = qs.topic_id
    WHERE tp.subject_id = 1
    ORDER BY abs(qs.question_rating - 1500), qs.question_id
    LIMIT 10
)
INSERT INTO quiz_questions (quiz_id, position, question_id)
SELECT new_quiz.quiz_id, picked.position, picked.question_id
FROM new_quiz CROSS JOIN picked;

-- @W3
-- WRITE W3 · Start a quiz: create a new attempt for user 42 on quiz 77
INSERT INTO quiz_attempts (quiz_id, user_id)
VALUES (77, 42)
RETURNING attempt_id;

-- @W4
-- WRITE W4 · Answer a question: save the answer to question 6 of attempt 50 (option 2, 7.2 s)
INSERT INTO attempt_answers (attempt_id, question_id, chosen_option_no, time_taken_ms)
SELECT a.attempt_id, qq.question_id, 2, 7200
FROM quiz_attempts a
JOIN quiz_questions qq ON qq.quiz_id = a.quiz_id AND qq.position = 6
WHERE a.attempt_id = 50;

-- @W5
-- WRITE W5 · Elo update after an answer: user 42 answered question 1001 correctly.
-- Expected score E = 1 / (1 + 10^((question rating - my rating) / 400)); K = 32.
-- My rating goes up by 32 * (1 - E) and the question's rating goes down by the same amount.
WITH game AS (
    SELECT ur.user_id, ur.subject_id, ur.rating AS my_rating,
           q.question_id, q.question_rating,
           1.0 / (1 + power(10, (q.question_rating - ur.rating) / 400.0)) AS expected,
           1 AS score                                     -- 1 = correct, 0 = wrong
    FROM user_ratings ur
    JOIN questions q ON q.question_id = 1001
    JOIN topics t    ON t.topic_id = q.topic_id AND t.subject_id = ur.subject_id
    WHERE ur.user_id = 42
),
update_me AS (
    UPDATE user_ratings ur
    SET rating = round(game.my_rating + 32 * (game.score - game.expected)), updated_at = now()
    FROM game
    WHERE ur.user_id = game.user_id AND ur.subject_id = game.subject_id
    RETURNING ur.rating
)
UPDATE questions q
SET question_rating = round(game.question_rating - 32 * (game.score - game.expected))
FROM game
WHERE q.question_id = game.question_id;

-- @W6
-- WRITE W6 · Start a duel: create a Blitz 3+2 duel, one attempt per player on quiz 73,
-- and record both players (42 = White, 43 = Black) with their current Physics rating
WITH new_duel AS (
    INSERT INTO duels (base_seconds, increment_seconds)
    VALUES (180, 2)
    RETURNING duel_id
),
new_attempts AS (
    INSERT INTO quiz_attempts (quiz_id, user_id)
    VALUES (73, 42), (73, 43)
    RETURNING attempt_id, user_id
)
INSERT INTO duel_players (duel_id, color, attempt_id, rating_before)
SELECT new_duel.duel_id,
       CASE WHEN na.user_id = 42 THEN 'WHITE' ELSE 'BLACK' END,
       na.attempt_id, ur.rating
FROM new_duel
CROSS JOIN new_attempts na
JOIN user_ratings ur ON ur.user_id = na.user_id AND ur.subject_id = 1;

-- @W7
-- WRITE W7 · Resign: White resigns running duel 100, so Black wins (0-1); save both rating changes
WITH finished AS (
    UPDATE duels
    SET result = '0-1', termination = 'RESIGN', ended_at = now()
    WHERE duel_id = 100 AND result IS NULL
    RETURNING duel_id
)
UPDATE duel_players dp
SET rating_change = CASE dp.color WHEN 'WHITE' THEN -12 ELSE 12 END
FROM finished
WHERE dp.duel_id = finished.duel_id;

-- @W8
-- WRITE W8 · Mistake Notebook: save a wrong answer with the AI's explanation
-- (if it is already in the notebook, start it again from box 1)
INSERT INTO mistake_notebook (user_id, question_id, ai_explanation, leitner_box, next_review_on)
VALUES (42, 1002, 'The slope of a velocity-time graph is acceleration; the area under it is displacement.',
        1, current_date + 1)
ON CONFLICT (user_id, question_id)
DO UPDATE SET ai_explanation = EXCLUDED.ai_explanation, leitner_box = 1, next_review_on = current_date + 1;

-- @W9
-- WRITE W9 · Revise a mistake: I got my most overdue mistake right, so it moves up one Leitner box
-- (box 2 -> review in 3 days, 3 -> 7 days, 4 -> 14 days, 5 -> 30 days)
UPDATE mistake_notebook
SET leitner_box = least(leitner_box + 1, 5),
    next_review_on = current_date + CASE least(leitner_box + 1, 5)
                                        WHEN 2 THEN 3 WHEN 3 THEN 7 WHEN 4 THEN 14 ELSE 30 END
WHERE (user_id, question_id) = (SELECT user_id, question_id FROM mistake_notebook
                                WHERE user_id = 42 AND next_review_on <= current_date
                                ORDER BY next_review_on, question_id LIMIT 1);

-- @W10
-- WRITE W10 · Focus timer: start a 25-minute Physics session
INSERT INTO study_sessions (user_id, subject_id, planned_minutes)
VALUES (42, 1, 25)
RETURNING session_id;

-- @W11
-- WRITE W11 · End the session: stop my running session (the oldest, if several) and record the break puzzle (solved)
UPDATE study_sessions
SET ended_at = now(), puzzle_id = 31, puzzle_solved = true
WHERE session_id = (SELECT session_id FROM study_sessions
                    WHERE user_id = 42 AND ended_at IS NULL
                    ORDER BY started_at LIMIT 1);

-- @W12
-- WRITE W12 · Pick a coach: user 42 joins Physics coach 111
-- (a trigger stops a second coach in the same subject)
INSERT INTO coaching (student_id, coach_id)
VALUES (42, 111);

-- @END
ROLLBACK;

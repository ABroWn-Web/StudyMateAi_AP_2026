-- =====================================================================
-- StudyMate AI: test data (needed to time the queries in 04_queries.sql)
--
-- Run after 03_schema.sql:   psql -d studymate -f dbms/seed_data.sql
-- Deterministic (setseed), takes ~30 s. Sizes:
--   50 colleges · 6 subjects · 48 topics · 20,000 users · 120,000 ratings
--   6,000 questions · 24,000 options · 1,200 quizzes · 12,000 quiz questions
--   76,000 attempts (60,000 practice + 16,000 in 8,000 duels) · ~740,000 answers
--   600 chess puzzles · 60,000 focus sessions · ~200,000 mistake-notebook rows
--   60 coaches · 3,000 coaching links
-- Users 1-100 are "active" users (20% of all activity); user 42 is the demo user.
-- =====================================================================
SET search_path TO studymate;
SELECT setseed(0.42);

INSERT INTO colleges (college_name, city)
SELECT 'College of Engineering ' || g,
       (ARRAY['Dehradun','Jaipur','Delhi','Mumbai','Pune','Bengaluru','Chennai','Hyderabad','Kolkata','Lucknow'])[1 + g % 10]
FROM generate_series(1, 50) g;

INSERT INTO subjects (subject_name)
VALUES ('Physics'), ('Chemistry'), ('Maths'), ('Biology'), ('Computer Science'), ('English');

-- 8 topics per subject: topic_id = (subject_id - 1) * 8 + n
INSERT INTO topics (subject_id, topic_name)
SELECT s, (SELECT subject_name FROM subjects WHERE subject_id = s) || ' Unit ' || n
FROM generate_series(1, 6) s, generate_series(1, 8) n
ORDER BY s, n;

INSERT INTO users (username, email, full_name, password_hash, college_id, created_at)
SELECT 'user_' || lpad(g::text, 5, '0'),
       'user' || lpad(g::text, 5, '0') || '@studymate.app',
       'Student ' || g,
       md5('pw' || g),
       CASE WHEN g % 10 = 0 THEN NULL ELSE 1 + g % 50 END,
       now() - random() * interval '365 days'
FROM generate_series(1, 20000) g;

-- every user has an Elo rating in every subject (roughly normal around 1200)
INSERT INTO user_ratings (user_id, subject_id, rating, updated_at)
SELECT u, s, greatest(400, least(2600, round(1200 + (random() + random() + random() + random() - 2) * 350)))::smallint,
       now() - random() * interval '30 days'
FROM generate_series(1, 20000) u, generate_series(1, 6) s;

-- 125 questions per topic: question_id = (topic_id - 1) * 125 + n, so subject s owns ids (s-1)*1000+1 .. s*1000
INSERT INTO questions (topic_id, question_text, question_rating, source, created_by, created_at)
SELECT t, 'Q' || ((t - 1) * 125 + n) || ' (' || (SELECT topic_name FROM topics WHERE topic_id = t) || '): which option is correct?',
       (700 + random() * 1300)::smallint,
       CASE WHEN n % 10 < 6 THEN 'AI' WHEN n % 10 < 9 THEN 'TEACHER' ELSE 'STUDENT' END,
       CASE WHEN n % 10 < 6 THEN NULL ELSE 1 + (t * 131 + n * 17) % 20000 END,
       now() - random() * interval '300 days'
FROM generate_series(1, 48) t, generate_series(1, 125) n
ORDER BY t, n;

-- 4 options each; the correct one is 1 + question_id % 4
INSERT INTO question_options (question_id, option_no, option_text, is_correct)
SELECT q, o, 'Option ' || o || ' of question ' || q, o = 1 + q % 4
FROM generate_series(1, 6000) q, generate_series(1, 4) o;

INSERT INTO quizzes (title, subject_id, is_ai_generated, created_by, created_at)
SELECT (SELECT subject_name FROM subjects WHERE subject_id = 1 + (g - 1) % 6) || ' Quiz #' || g,
       1 + (g - 1) % 6, g % 3 <> 0,
       CASE WHEN g % 3 = 0 THEN 1 + (g * 7919) % 20000 END,
       now() - random() * interval '200 days'
FROM generate_series(1, 1200) g;

-- 10 distinct questions of the quiz's subject per quiz
INSERT INTO quiz_questions (quiz_id, position, question_id)
SELECT g, p, ((g - 1) % 6) * 1000 + 1 + (g * 37 + p * 101) % 1000
FROM generate_series(1, 1200) g, generate_series(1, 10) p;

-- 60,000 practice attempts; every 50th is still in progress (no finished_at, only 5 answers)
INSERT INTO quiz_attempts (quiz_id, user_id, started_at, finished_at)
SELECT q, u, st, CASE WHEN g % 50 = 0 THEN NULL ELSE st + (5 + random() * 15) * interval '1 minute' END
FROM (SELECT g,
             1 + floor(random() * 1200)::int AS q,
             CASE WHEN random() < 0.2 THEN 1 + floor(random() * 100)::int ELSE 1 + floor(random() * 20000)::int END AS u,
             now() - random() * interval '180 days' AS st
      FROM generate_series(1, 60000) g) x
ORDER BY g;

-- 8,000 duels; every 100th is still running. Duel d uses attempts 60000+2d-1 (White) and 60000+2d (Black).
INSERT INTO duels (base_seconds, increment_seconds, result, termination, started_at, ended_at)
SELECT (ARRAY[180, 300, 600])[1 + d % 3], (ARRAY[2, 0, 5])[1 + d % 3],
       CASE WHEN d % 100 = 0 THEN NULL WHEN r < 0.45 THEN '1-0' WHEN r < 0.9 THEN '0-1' ELSE '1/2-1/2' END,
       CASE WHEN d % 100 = 0 THEN NULL WHEN t < 0.85 THEN 'SCORE' WHEN t < 0.95 THEN 'RESIGN' ELSE 'TIMEOUT' END,
       st, CASE WHEN d % 100 = 0 THEN NULL ELSE st + (2 + random() * 8) * interval '1 minute' END
FROM (SELECT d, random() AS r, random() AS t, now() - random() * interval '120 days' AS st
      FROM generate_series(1, 8000) d) x
ORDER BY d;

INSERT INTO quiz_attempts (attempt_id, quiz_id, user_id, started_at, finished_at)
SELECT 60000 + 2 * du.duel_id - c, 1 + (du.duel_id * 7) % 1200,
       CASE WHEN c = 1 THEN (CASE WHEN du.duel_id % 400 = 7 THEN 42 ELSE 1 + (du.duel_id * 13) % 20000 END)
            ELSE 1 + (du.duel_id * 29 + 5) % 20000 END,
       du.started_at, du.ended_at
FROM duels du, generate_series(0, 1) c
ORDER BY 1;

INSERT INTO duel_players (duel_id, color, attempt_id, rating_before, rating_change)
SELECT du.duel_id, CASE WHEN c = 1 THEN 'WHITE' ELSE 'BLACK' END, 60000 + 2 * du.duel_id - c,
       (900 + random() * 800)::smallint,
       CASE WHEN du.result IS NULL THEN NULL
            WHEN du.result = '1/2-1/2' THEN 0
            WHEN (du.result = '1-0') = (c = 1) THEN (4 + random() * 20)::smallint
            ELSE -(4 + random() * 20)::smallint END
FROM duels du, generate_series(0, 1) c;

-- answers: 10 per finished attempt, 5 per unfinished one; ~60% correct, ~8% skipped
INSERT INTO attempt_answers (attempt_id, question_id, chosen_option_no, time_taken_ms)
SELECT a.attempt_id, qq.question_id,
       CASE WHEN random() < 0.08 THEN NULL
            WHEN random() < 0.6 THEN 1 + qq.question_id % 4
            ELSE 1 + floor(random() * 4)::int END,
       (2000 + random() * 58000)::int
FROM quiz_attempts a
JOIN quiz_questions qq ON qq.quiz_id = a.quiz_id
WHERE qq.position <= CASE WHEN a.finished_at IS NULL THEN 5 ELSE 10 END;

-- 600 chess puzzles: 4 classic mating patterns x 150 move numbers (unique FENs)
INSERT INTO chess_puzzles (fen, solution_moves, puzzle_rating, theme)
SELECT format(p.fen, m), p.sol, (p.base + random() * 400)::smallint, p.theme
FROM (VALUES ('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 %s', 'd1d8', 500, 'backRankMate'),
             ('rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 %s', 'd8h4', 300, 'mateIn1'),
             ('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 %s', 'h5f7', 700, 'mateIn1'),
             ('6k1/5ppp/8/8/8/8/1Q3PPP/6K1 w - - 0 %s', 'b2b8', 900, 'backRankMate')) p(fen, sol, base, theme),
     generate_series(1, 150) m;

-- 60,000 Pomodoro focus sessions over 90 days; 3% still running (no puzzle yet)
INSERT INTO study_sessions (user_id, subject_id, started_at, ended_at, planned_minutes, puzzle_id, puzzle_solved)
SELECT u, s, st, CASE WHEN running THEN NULL ELSE st + (pm + (random() * 15 - 5)) * interval '1 minute' END, pm,
       CASE WHEN running OR random() < 0.15 THEN NULL ELSE 1 + floor(random() * 600)::int END, NULL
FROM (SELECT CASE WHEN random() < 0.2 THEN 1 + floor(random() * 100)::int ELSE 1 + floor(random() * 20000)::int END AS u,
             1 + floor(random() * 6)::int AS s, now() - random() * interval '90 days' AS st,
             (ARRAY[25, 50])[1 + floor(random() * 2)::int] AS pm, random() < 0.03 AS running
      FROM generate_series(1, 60000) g) x;
UPDATE study_sessions SET puzzle_solved = random() < 0.6 WHERE puzzle_id IS NOT NULL;
-- the demo user has one session running right now
INSERT INTO study_sessions (user_id, subject_id, started_at, planned_minutes)
VALUES (42, 1, now() - interval '20 minutes', 25);

-- mistake notebook: every (user, question) answered wrongly, with an AI explanation and a Leitner box
INSERT INTO mistake_notebook (user_id, question_id, ai_explanation, leitner_box, next_review_on, added_at)
SELECT DISTINCT ON (a.user_id, aa.question_id)
       a.user_id, aa.question_id,
       'You chose option ' || aa.chosen_option_no || '. The correct answer is option ' || (1 + aa.question_id % 4)
         || ': (AI explanation of the concept goes here).',
       1 + floor(random() * 5)::int, current_date + (floor(random() * 30) - 10)::int, a.started_at
FROM attempt_answers aa
JOIN quiz_attempts a ON a.attempt_id = aa.attempt_id
WHERE aa.chosen_option_no IS NOT NULL AND aa.chosen_option_no <> 1 + aa.question_id % 4
ORDER BY a.user_id, aa.question_id, a.started_at;

-- coaches: users 111-170, 10 per subject (coach of subject s = 100 + 10*s + k)
INSERT INTO coaches (coach_id, subject_id)
SELECT 100 + 10 * s + k, s FROM generate_series(1, 6) s, generate_series(1, 10) k;
-- 3,000 students (users 201-3200), one coach each
INSERT INTO coaching (student_id, coach_id)
SELECT 200 + g, 100 + 10 * (1 + g % 6) + 1 + g % 10 FROM generate_series(1, 3000) g;
-- the demo user has a Maths coach (and no Physics coach yet)
INSERT INTO coaching (student_id, coach_id) VALUES (42, 131);

-- identity counters continue after the highest id used
SELECT setval('studymate.colleges_college_id_seq',       (SELECT max(college_id)  FROM colleges));
SELECT setval('studymate.users_user_id_seq',             (SELECT max(user_id)     FROM users));
SELECT setval('studymate.subjects_subject_id_seq',       (SELECT max(subject_id)  FROM subjects));
SELECT setval('studymate.topics_topic_id_seq',           (SELECT max(topic_id)    FROM topics));
SELECT setval('studymate.questions_question_id_seq',     (SELECT max(question_id) FROM questions));
SELECT setval('studymate.quizzes_quiz_id_seq',           (SELECT max(quiz_id)     FROM quizzes));
SELECT setval('studymate.quiz_attempts_attempt_id_seq',  (SELECT max(attempt_id)  FROM quiz_attempts));
SELECT setval('studymate.duels_duel_id_seq',             (SELECT max(duel_id)     FROM duels));
SELECT setval('studymate.chess_puzzles_puzzle_id_seq',   (SELECT max(puzzle_id)   FROM chess_puzzles));
SELECT setval('studymate.study_sessions_session_id_seq', (SELECT max(session_id)  FROM study_sessions));

VACUUM ANALYZE;

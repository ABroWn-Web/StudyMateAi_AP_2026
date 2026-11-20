-- website/setup.sql - run ONCE after dbms/03_schema.sql and dbms/seed_data.sql:
--   psql -d studymate -f website/setup.sql
SET search_path TO studymate;

-- 1. Demo login: user 42 (user00042@studymate.app) gets the password "demo1234".
--    The value is a bcrypt hash, never the plain password.
UPDATE users
SET password_hash = '$2a$10$uCvSlpYuKs9R3cPlqOG/pen.ToA03oFw6RNksjhg6ycR8NpX0HhlO'
WHERE user_id = 42;

-- 2. One "Adaptive Practice" quiz per subject. Practice answers are saved as an
--    attempt on this quiz, so the app remembers which questions you have already seen.
INSERT INTO quizzes (title, subject_id, is_ai_generated)
SELECT 'Adaptive Practice · ' || subject_name, subject_id, true
FROM subjects
WHERE NOT EXISTS (SELECT 1 FROM quizzes q
                  WHERE q.subject_id = subjects.subject_id AND q.title LIKE 'Adaptive Practice%');

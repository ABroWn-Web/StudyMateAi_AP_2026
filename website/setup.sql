-- website/setup.sql - run after dbms/03_schema.sql and dbms/seed_data.sql (safe to run again):
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

-- 3. Real mate-in-1 puzzles (each verified with the python-chess library: legal position, exactly ONE mating move).
INSERT INTO chess_puzzles (fen, solution_moves, puzzle_rating, theme) VALUES
  ('6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', 'e1e8', 550, 'Back-rank mate (rook)'),
  ('4r1k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', 'e8e1', 600, 'Back-rank mate (Black)'),
  ('6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', 'g5f7', 1200, 'Smothered mate'),
  ('7k/8/8/8/4n3/8/6PP/6RK b - - 0 1', 'e4f2', 1250, 'Smothered mate (Black)'),
  ('5r2/4Nppk/8/8/8/3R4/PP6/K7 w - - 0 1', 'd3h3', 1350, 'Anastasia''s mate'),
  ('7k/1R6/5N2/8/8/8/8/6K1 w - - 0 1', 'b7h7', 1100, 'Arabian mate'),
  ('k7/7Q/2K5/8/8/8/8/8 w - - 0 1', 'h7b7', 800, 'Kiss of death'),
  ('5rk1/8/6P1/8/8/8/8/6KQ w - - 0 1', 'h1h7', 1000, 'Damiano''s mate'),
  ('4kb1r/5ppp/8/6B1/8/8/8/3RK3 w - - 0 1', 'd1d8', 1300, 'Opera mate'),
  ('4k3/8/4K3/8/8/8/8/R7 w - - 0 1', 'a1a8', 650, 'Rook and king mate'),
  ('r7/8/8/8/8/4k3/8/4K3 b - - 0 1', 'a8a1', 650, 'Rook and king mate (Black)'),
  ('6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1', 'b1b8', 500, 'Ladder mate (two rooks)'),
  ('5rk1/5pp1/8/7Q/8/3B4/8/6K1 w - - 0 1', 'h5h7', 900, 'Queen and bishop on h7'),
  ('6k1/8/3b4/8/7q/8/5PP1/5RK1 b - - 0 1', 'h4h2', 950, 'Queen and bishop on h2 (Black)'),
  ('3rkr2/8/8/8/8/8/Q7/6K1 w - - 0 1', 'a2e6', 1400, 'Epaulette mate'),
  ('7k/6pp/8/6N1/8/8/8/5QK1 w - - 0 1', 'f1f8', 750, 'Queen back-rank with knight'),
  ('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'h5f7', 400, 'Scholar''s mate'),
  ('rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', 'd8h4', 300, 'Fool''s mate'),
  ('6k1/5ppp/8/8/8/8/Q4PPP/6K1 w - - 0 1', 'a2a8', 850, 'Corridor mate (queen)')
ON CONFLICT (fen) DO NOTHING;

-- 4. Coaches are elite Grandmasters (2600-2780) in the subject they coach,
--    and get a real name (an international mix) instead of "Student 111".
UPDATE user_ratings ur
SET rating = 2600 + (co.coach_id * 37) % 181
FROM coaches co
WHERE ur.user_id = co.coach_id AND ur.subject_id = co.subject_id;

UPDATE users u
SET full_name = n.full_name, username = n.username
FROM (VALUES
    (111, 'Lucas Rossi', 'lucas_rossi'),
    (112, 'Sofia Garcia', 'sofia_garcia'),
    (113, 'Mateo Costa', 'mateo_costa'),
    (114, 'Emma Becker', 'emma_becker'),
    (115, 'Hiroshi Kovacs', 'hiroshi_kovacs'),
    (116, 'Yuki Andersen', 'yuki_andersen'),
    (117, 'Liam Larsen', 'liam_larsen'),
    (118, 'Olivia Zhang', 'olivia_zhang'),
    (119, 'Noah Jensen', 'noah_jensen'),
    (120, 'Mia Silva', 'mia_silva'),
    (121, 'Arjun Haddad', 'arjun_haddad'),
    (122, 'Priya Mehta', 'priya_mehta'),
    (123, 'Wei Kaur', 'wei_kaur'),
    (124, 'Mei Tanaka', 'mei_tanaka'),
    (125, 'Jonas Petrov', 'jonas_petrov'),
    (126, 'Elena Sato', 'elena_sato'),
    (127, 'Ivan Hansen', 'ivan_hansen'),
    (128, 'Anya Nguyen', 'anya_nguyen'),
    (129, 'Omar Dubois', 'omar_dubois'),
    (130, 'Leila Moreau', 'leila_moreau'),
    (131, 'Diego Santos', 'diego_santos'),
    (132, 'Valentina Ferreira', 'valentina_ferreira'),
    (133, 'Kofi Kowalski', 'kofi_kowalski'),
    (134, 'Amara Okafor', 'amara_okafor'),
    (135, 'Felix Iyer', 'felix_iyer'),
    (136, 'Nora Varga', 'nora_varga'),
    (137, 'Ravi Novak', 'ravi_novak'),
    (138, 'Ana Nakamura', 'ana_nakamura'),
    (139, 'Jin Lindqvist', 'jin_lindqvist'),
    (140, 'Freya Rahman', 'freya_rahman'),
    (141, 'Lucas Tanaka', 'lucas_tanaka'),
    (142, 'Sofia Petrov', 'sofia_petrov'),
    (143, 'Mateo Sato', 'mateo_sato'),
    (144, 'Emma Hansen', 'emma_hansen'),
    (145, 'Hiroshi Nguyen', 'hiroshi_nguyen'),
    (146, 'Yuki Dubois', 'yuki_dubois'),
    (147, 'Liam Moreau', 'liam_moreau'),
    (148, 'Olivia Santos', 'olivia_santos'),
    (149, 'Noah Ferreira', 'noah_ferreira'),
    (150, 'Mia Kowalski', 'mia_kowalski'),
    (151, 'Arjun Okafor', 'arjun_okafor'),
    (152, 'Priya Iyer', 'priya_iyer'),
    (153, 'Wei Varga', 'wei_varga'),
    (154, 'Mei Novak', 'mei_novak'),
    (155, 'Jonas Nakamura', 'jonas_nakamura'),
    (156, 'Elena Lindqvist', 'elena_lindqvist'),
    (157, 'Ivan Rahman', 'ivan_rahman'),
    (158, 'Anya Rossi', 'anya_rossi'),
    (159, 'Omar Garcia', 'omar_garcia'),
    (160, 'Leila Costa', 'leila_costa'),
    (161, 'Diego Becker', 'diego_becker'),
    (162, 'Valentina Kovacs', 'valentina_kovacs'),
    (163, 'Kofi Andersen', 'kofi_andersen'),
    (164, 'Amara Larsen', 'amara_larsen'),
    (165, 'Felix Zhang', 'felix_zhang'),
    (166, 'Nora Jensen', 'nora_jensen'),
    (167, 'Ravi Silva', 'ravi_silva'),
    (168, 'Ana Haddad', 'ana_haddad'),
    (169, 'Jin Mehta', 'jin_mehta'),
    (170, 'Freya Kaur', 'freya_kaur')
) AS n(user_id, full_name, username)
WHERE u.user_id = n.user_id;

-- 5. Like real chess: in every subject only the top 3 players are rated 2800+,
--    the next 7 are strong Grandmasters (2590 down to 2518), so the top 20 are all GMs.
WITH ranked AS (
    SELECT ur.user_id, ur.subject_id,
           row_number() OVER (PARTITION BY ur.subject_id ORDER BY ur.rating DESC, ur.user_id) AS rn
    FROM user_ratings ur
    WHERE NOT EXISTS (SELECT 1 FROM coaches co WHERE co.coach_id = ur.user_id)
)
UPDATE user_ratings ur
SET rating = CASE ranked.rn WHEN 1 THEN 2847 WHEN 2 THEN 2819 WHEN 3 THEN 2803 ELSE 2590 - 12 * (ranked.rn - 4) END
FROM ranked
WHERE ur.user_id = ranked.user_id AND ur.subject_id = ranked.subject_id AND ranked.rn <= 10;

-- 6. Worldwide universities (fictional names, real cities; only 3 in India).
UPDATE colleges c
SET college_name = n.college_name, city = n.city
FROM (VALUES
    (1, 'Ashford University', 'Boston'),
    (2, 'Brightwater University', 'London'),
    (3, 'Calder University', 'Zurich'),
    (4, 'Dunmore University', 'Singapore'),
    (5, 'Elmhurst University', 'Tokyo'),
    (6, 'Fairhaven University', 'Toronto'),
    (7, 'Glenmoor University', 'Melbourne'),
    (8, 'Harrowgate University', 'Paris'),
    (9, 'Ivybridge University', 'Berlin'),
    (10, 'Kingsbury University', 'Seoul'),
    (11, 'Ashford Institute of Technology', 'Stockholm'),
    (12, 'Brightwater Institute of Technology', 'Amsterdam'),
    (13, 'Calder Institute of Technology', 'Munich'),
    (14, 'Dunmore Institute of Technology', 'Vienna'),
    (15, 'Elmhurst Institute of Technology', 'Copenhagen'),
    (16, 'Fairhaven Institute of Technology', 'Edinburgh'),
    (17, 'Glenmoor Institute of Technology', 'Montreal'),
    (18, 'Harrowgate Institute of Technology', 'Sydney'),
    (19, 'Ivybridge Institute of Technology', 'Hong Kong'),
    (20, 'Kingsbury Institute of Technology', 'Shanghai'),
    (21, 'Ashford College', 'Bengaluru'),
    (22, 'Brightwater College', 'Delft'),
    (23, 'Calder College', 'Helsinki'),
    (24, 'Dunmore College', 'Oslo'),
    (25, 'Elmhurst College', 'Madrid'),
    (26, 'Fairhaven College', 'Barcelona'),
    (27, 'Glenmoor College', 'Milan'),
    (28, 'Harrowgate College', 'Geneva'),
    (29, 'Ivybridge College', 'Vancouver'),
    (30, 'Kingsbury College', 'Chicago'),
    (31, 'Ashford Polytechnic', 'San Francisco'),
    (32, 'Brightwater Polytechnic', 'New York'),
    (33, 'Calder Polytechnic', 'Mumbai'),
    (34, 'Dunmore Polytechnic', 'Seattle'),
    (35, 'Elmhurst Polytechnic', 'Austin'),
    (36, 'Fairhaven Polytechnic', 'Pittsburgh'),
    (37, 'Glenmoor Polytechnic', 'Atlanta'),
    (38, 'Harrowgate Polytechnic', 'Tel Aviv'),
    (39, 'Ivybridge Polytechnic', 'Dubai'),
    (40, 'Kingsbury Polytechnic', 'Cape Town'),
    (41, 'Ashford School of Science', 'Sao Paulo'),
    (42, 'Brightwater School of Science', 'Mexico City'),
    (43, 'Calder School of Science', 'Buenos Aires'),
    (44, 'Dunmore School of Science', 'Auckland'),
    (45, 'Elmhurst School of Science', 'Kyoto'),
    (46, 'Fairhaven School of Science', 'Delhi'),
    (47, 'Glenmoor School of Science', 'Lisbon'),
    (48, 'Harrowgate School of Science', 'Prague'),
    (49, 'Ivybridge School of Science', 'Dublin'),
    (50, 'Kingsbury School of Science', 'Brussels')
) AS n(college_id, college_name, city)
WHERE c.college_id = n.college_id;

-- 7. The non-coach Grandmasters (rating >= 2200) also get real names (numbered in user_id order).
WITH gms AS (
    SELECT DISTINCT ur.user_id
    FROM user_ratings ur
    WHERE ur.rating >= 2200 AND NOT EXISTS (SELECT 1 FROM coaches co WHERE co.coach_id = ur.user_id)
), numbered AS (
    SELECT user_id, row_number() OVER (ORDER BY user_id) AS n FROM gms
)
UPDATE users u
SET full_name = names.full_name, username = names.username
FROM numbered
JOIN (VALUES
    (1, 'Priya Silva', 'priya_silva'),
    (2, 'Wei Haddad', 'wei_haddad'),
    (3, 'Mei Mehta', 'mei_mehta'),
    (4, 'Jonas Kaur', 'jonas_kaur'),
    (5, 'Elena Tanaka', 'elena_tanaka'),
    (6, 'Ivan Petrov', 'ivan_petrov'),
    (7, 'Anya Sato', 'anya_sato'),
    (8, 'Omar Hansen', 'omar_hansen'),
    (9, 'Leila Nguyen', 'leila_nguyen'),
    (10, 'Diego Dubois', 'diego_dubois'),
    (11, 'Valentina Moreau', 'valentina_moreau'),
    (12, 'Kofi Santos', 'kofi_santos'),
    (13, 'Amara Ferreira', 'amara_ferreira'),
    (14, 'Felix Kowalski', 'felix_kowalski'),
    (15, 'Nora Okafor', 'nora_okafor'),
    (16, 'Ravi Iyer', 'ravi_iyer'),
    (17, 'Ana Varga', 'ana_varga'),
    (18, 'Jin Novak', 'jin_novak'),
    (19, 'Freya Nakamura', 'freya_nakamura'),
    (20, 'Lucas Lindqvist', 'lucas_lindqvist'),
    (21, 'Sofia Rahman', 'sofia_rahman'),
    (22, 'Mateo Rossi', 'mateo_rossi'),
    (23, 'Emma Garcia', 'emma_garcia'),
    (24, 'Hiroshi Costa', 'hiroshi_costa'),
    (25, 'Yuki Becker', 'yuki_becker'),
    (26, 'Liam Kovacs', 'liam_kovacs'),
    (27, 'Olivia Andersen', 'olivia_andersen'),
    (28, 'Noah Larsen', 'noah_larsen'),
    (29, 'Mia Zhang', 'mia_zhang'),
    (30, 'Arjun Jensen', 'arjun_jensen'),
    (31, 'Priya Kowalski', 'priya_kowalski'),
    (32, 'Wei Okafor', 'wei_okafor'),
    (33, 'Mei Iyer', 'mei_iyer'),
    (34, 'Jonas Varga', 'jonas_varga'),
    (35, 'Elena Novak', 'elena_novak'),
    (36, 'Ivan Nakamura', 'ivan_nakamura'),
    (37, 'Anya Lindqvist', 'anya_lindqvist'),
    (38, 'Omar Rahman', 'omar_rahman'),
    (39, 'Leila Rossi', 'leila_rossi'),
    (40, 'Diego Garcia', 'diego_garcia'),
    (41, 'Valentina Costa', 'valentina_costa'),
    (42, 'Kofi Becker', 'kofi_becker'),
    (43, 'Amara Kovacs', 'amara_kovacs'),
    (44, 'Felix Andersen', 'felix_andersen'),
    (45, 'Nora Larsen', 'nora_larsen'),
    (46, 'Ravi Zhang', 'ravi_zhang'),
    (47, 'Ana Jensen', 'ana_jensen'),
    (48, 'Jin Silva', 'jin_silva'),
    (49, 'Freya Haddad', 'freya_haddad'),
    (50, 'Lucas Mehta', 'lucas_mehta'),
    (51, 'Sofia Kaur', 'sofia_kaur'),
    (52, 'Mateo Tanaka', 'mateo_tanaka'),
    (53, 'Emma Petrov', 'emma_petrov'),
    (54, 'Hiroshi Sato', 'hiroshi_sato'),
    (55, 'Yuki Hansen', 'yuki_hansen'),
    (56, 'Liam Nguyen', 'liam_nguyen'),
    (57, 'Olivia Dubois', 'olivia_dubois'),
    (58, 'Noah Moreau', 'noah_moreau'),
    (59, 'Mia Santos', 'mia_santos'),
    (60, 'Arjun Ferreira', 'arjun_ferreira'),
    (61, 'Priya Andersen', 'priya_andersen'),
    (62, 'Wei Larsen', 'wei_larsen'),
    (63, 'Mei Zhang', 'mei_zhang'),
    (64, 'Jonas Jensen', 'jonas_jensen'),
    (65, 'Elena Silva', 'elena_silva'),
    (66, 'Ivan Haddad', 'ivan_haddad'),
    (67, 'Anya Mehta', 'anya_mehta'),
    (68, 'Omar Kaur', 'omar_kaur'),
    (69, 'Leila Tanaka', 'leila_tanaka'),
    (70, 'Diego Petrov', 'diego_petrov'),
    (71, 'Valentina Sato', 'valentina_sato'),
    (72, 'Kofi Hansen', 'kofi_hansen'),
    (73, 'Amara Nguyen', 'amara_nguyen'),
    (74, 'Felix Dubois', 'felix_dubois'),
    (75, 'Nora Moreau', 'nora_moreau'),
    (76, 'Ravi Santos', 'ravi_santos'),
    (77, 'Ana Ferreira', 'ana_ferreira'),
    (78, 'Jin Kowalski', 'jin_kowalski'),
    (79, 'Freya Okafor', 'freya_okafor'),
    (80, 'Lucas Iyer', 'lucas_iyer')
) AS names(n, full_name, username) ON names.n = numbered.n
WHERE u.user_id = numbered.user_id;

-- 8. Spread the coached students evenly over the 10 coaches of each subject (the demo user is left alone).
--    Delete + insert instead of update: the trigger rightly refuses a 2nd coach in the same subject mid-update.
CREATE TEMP TABLE new_coaching AS
SELECT ch.student_id,
       100 + 10 * co.subject_id + 1 + (row_number() OVER (PARTITION BY co.subject_id ORDER BY ch.student_id) - 1) % 10 AS coach_id
FROM coaching ch
JOIN coaches co ON co.coach_id = ch.coach_id
WHERE ch.student_id <> 42;
DELETE FROM coaching WHERE student_id IN (SELECT student_id FROM new_coaching);
INSERT INTO coaching (student_id, coach_id) SELECT student_id, coach_id FROM new_coaching;
DROP TABLE new_coaching;

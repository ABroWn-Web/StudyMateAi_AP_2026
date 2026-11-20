# StudyMate AI: website

A study app built with **Node.js + Express + PostgreSQL**, using the database designed in [`../dbms`](../dbms).

**Idea in one line:** paste your notes and get a study kit (summary, key concepts, flashcards, quiz). Then train against a question bank where *every question is a chess-style opponent* with its own Elo rating.

## Run it

You need **Node.js 18+** and **PostgreSQL 15+**. Run these from the repository root:

```bash
export PGUSER=postgres PGPASSWORD='your-postgres-password'
createdb studymate
psql -d studymate -f dbms/03_schema.sql      # 19 tables
psql -d studymate -f dbms/seed_data.sql      # test data, ~30 s
psql -d studymate -f website/setup.sql       # demo login + practice quizzes
cd website
npm install
npm start                                     # -> http://localhost:3000
```

Demo login: **user00042@studymate.app** / **demo1234**

## Features

| Page | What it does |
|---|---|
| **Workspace** | Paste notes or pick a sample topic. You get a summary, key concepts, flip-flashcards, a practice quiz with instant score + explanation, an "explain like a teacher" panel, and session history. |
| **Dashboard** | Your rating and chess title in every subject, mistakes due, focus minutes, weakest topics, recent duels. |
| **Practice** | Adaptive: you get the unseen question closest to your rating. Win = rating up, question rating down. |
| **Quizzes** | 10-question quizzes, plus an **AI quiz generator** that builds a quiz around your rating. Includes a full answer review. |
| **Duels** | **Quick pairing** tiles (1+0 / 3+2 / 10+0) or challenge a rival near your rating. Same quiz, **chess clock** (Bullet 1+0, Blitz 3+2, Rapid 10+0), resign or lose on time, and a scoresheet at the end. |
| **Mistake notebook** | Every wrong answer, with an explanation, revised on a Leitner-box schedule (1 day → 30 days). |
| **Focus timer** | Pomodoro 25 or 50 min. The break is a **chess puzzle** on a real board. |
| **Leaderboard / Coaches** | Top students and universities per subject, with chess-style title tags (GM, IM, FM, CM); pick a coach (one per subject, enforced by a database trigger). |
| **Tournaments** *(coming soon)* | Arena / Swiss / Knockout events with a launch countdown, sponsored by the top 10 universities (ranked live from the database). |

## Folder structure

```
website/
├── server.js          starts Express, sessions, mounts the routes          (BACKEND)
├── db.js              PostgreSQL connection pool + transaction helper      (BACKEND)
├── setup.sql          demo login, practice quizzes, puzzles, GM coaches + names (safe to re-run)
├── lib/
│   ├── elo.js         the chess rating formula
│   ├── grading.js     what happens when a question is answered
│   ├── studyEngine.js notes -> summary, concepts, flashcards, quiz
│   ├── samples.js     6 sample notes
│   └── helpers.js     login check, error wrapper, flash messages
├── routes/            one file per feature: URL -> SQL -> page           (BACKEND)
├── views/             EJS pages: HTML with <%= values %>                  (FRONTEND)
└── public/            style.css + 4 small browser scripts                (FRONTEND)
```

## Which SQL each page runs

The ids refer to [`dbms/04_queries.sql`](../dbms/04_queries.sql).

| Route file | Reads | Writes |
|---|---|---|
| `auth.js` | R1 login | W1 sign up (+ 6 starting ratings) |
| `dashboard.js` | R2 ratings + titles, R11 duels, R13 (count), R14 weak topics, R15 focus | — |
| `practice.js` | R12 next question | W3 practice attempt, W4 answer, W5 Elo, W8 notebook |
| `quizzes.js` | R5 library, R6 questions, R7 score, R8 review | W2 AI quiz, W3 start, W4/W5/W8 per answer |
| `duels.js` | R9 rivals (also used by quick pairing), R10 scoresheet, R11 history | W6 create duel, W7 finish/resign |
| `notebook.js` | R13 due mistakes | W9 next Leitner box |
| `focus.js` | R15 stats, R16 puzzle | W10 start, W11 end + puzzle |
| `leaderboard.js` | R3 students, R4 colleges | — |
| `coaches.js` | R17 coaches | W12 join coach |
| `study.js` | — (works on the pasted text, in `lib/studyEngine.js`) | — |
| `tournaments.js` | top 10 universities by average rating | — (tournaments live in `lib/tournaments.js` until launch) |

See [`EXPLAIN.md`](EXPLAIN.md) for a walkthrough of how everything works.

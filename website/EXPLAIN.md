# How StudyMate AI works (explanation guide)

## 1. The 30-second pitch

> "StudyMate AI turns your notes into a study kit: a summary, key concepts, flashcards and a quiz. Then it trains you like chess. Every question has an Elo rating, just like a chess opponent. You always get a question near your level, and beating it raises your rating. You can duel friends on a chess clock, revise your mistakes on a spaced-repetition schedule, and take chess-puzzle breaks in your study sessions."

## 2. The architecture (3 layers)

```
 Browser (HTML + CSS + 4 tiny JS files)
        │  1. click / submit a form  →  HTTP request (GET or POST)
        ▼
 Express server (Node.js)  ── routes/*.js  ── lib/*.js (Elo, grading, study engine)
        │  2. runs SQL with node-postgres (pg)
        ▼
 PostgreSQL database "studymate" (19 tables, from dbms/03_schema.sql)
        │  3. rows come back
        ▼
 Express fills an EJS template with the rows  →  4. sends back finished HTML
```

- **Frontend** = `views/` (EJS pages) + `public/` (CSS + small browser scripts).
- **Backend** = `server.js`, `routes/`, `lib/`, `db.js`.
- The pages are **server-rendered**: the server builds the whole HTML page. That is why we need very little JavaScript in the browser.

## 3. One click, start to finish: "Submit answer" on Practice

1. The form in `views/practice.ejs` sends `POST /practice/answer` with `question_id` and `option`.
2. `server.js` checks you are logged in (`requireLogin`) and passes the request to `routes/practice.js`.
3. The route opens a **transaction** (`db.transaction`) and calls `gradeAnswer` in `lib/grading.js`, which:
   - saves the answer (`INSERT INTO attempt_answers`)
   - computes the Elo change (`lib/elo.js`) and updates **your** rating up/down and the **question's** rating the opposite way
   - if you were wrong, adds the question to the **Mistake Notebook** with an explanation
4. `COMMIT`: all of it is saved together. If anything failed, `ROLLBACK` undoes all of it.
5. The route **redirects** to `GET /practice`. That route runs SQL R12 (the unseen question closest to your new rating) and renders the page with the result banner.

## 4. Every concept in one or two lines

| Concept | Simple explanation | Where |
|---|---|---|
| **Express route** | "When this URL is requested, run this function." `router.get('/practice', …)` | `routes/*.js` |
| **Middleware** | A function that runs before the routes, e.g. `requireLogin` redirects to `/login` if you aren't logged in. | `lib/helpers.js`, `server.js` |
| **EJS template** | HTML with holes. `<%= value %>` prints safely (escaped); `<% code %>` runs JS like loops. | `views/` |
| **Session + cookie** | After login we store your user id in the session. The browser keeps a cookie with the session id, so later requests know who you are. | `express-session` in `server.js` |
| **Password hashing** | We never store passwords, only a **bcrypt hash**. At login we compare hashes. | `routes/auth.js` |
| **SQL injection protection** | Values are passed as `$1, $2` parameters, never glued into the SQL text. | every `db.query` |
| **Connection pool** | A few database connections are kept open and reused, which is faster than connecting for every query. | `db.js` |
| **Transaction** | Several SQL statements that must all succeed or all fail (`BEGIN … COMMIT / ROLLBACK`). | `db.transaction` |
| **POST → redirect → GET** | After a form submit we redirect, so refreshing the page doesn't submit the form twice. | all POST routes |
| **Database constraints** | The database itself refuses bad data, e.g. two correct options per question, or a second coach in the same subject (a trigger). The app shows a friendly message. | `dbms/03_schema.sql`, `routes/coaches.js` |
| **Elo rating** | `expected = 1 / (1 + 10^((opponent − me)/400))`, `change = 32 × (result − expected)`. Example: 1200 vs a 1400 question: expected 0.24. Win = +24, loss = −8. | `lib/elo.js` |
| **Chess titles** | Looked up from the `titles` table: CM 1600, FM 1800, IM 2000, GM 2200. Not stored per user, so they never go out of date. | dashboard / leaderboard SQL |
| **Leitner boxes** | Spaced repetition. Right answer → next box, reviewed later (1, 3, 7, 14, 30 days). Wrong answer → back to box 1. | `routes/notebook.js` |
| **Chess clock** | Browser JS counts your time down; each answer adds the increment (+2 s in Blitz 3+2). At 0 the form submits as a loss on time. | `public/duel.js` |
| **Simulated rival** | The rival answers each question correctly with probability = Elo expected score (rival rating vs question rating). | `routes/duels.js` |
| **FEN** | A one-line text format for a chess position. `public/board.js` turns it into an 8×8 board. | `public/board.js` |
| **Quick pairing** | Like lichess: pick a time control and the app runs R9 (closest-rated rival) and starts a duel with the first result. | `routes/duels.js` |
| **Tournaments (coming soon)** | Static list in `lib/tournaments.js`; sponsors = top 10 universities by average rating (live SQL). At launch: new tables `tournaments` and `tournament_players`. | `routes/tournaments.js` |
| **Light / dark mode** | All colours are CSS variables; `data-theme="dark"` swaps them. The choice is remembered in `localStorage`. | `public/style.css`, header |

## 5. The Study Workspace "AI": five simple rules (`lib/studyEngine.js`)

1. **Key concepts:** count every word and two-word phrase, ignoring filler words ("the", "is"…) and common verbs. A term that a sentence *defines* ("A noun is…") gets a bonus. Top 8 = key concepts.
2. **Summary:** score each sentence by how many key concepts it contains. The top 3, in their original order, form the summary.
3. **Flashcards:** take the best sentence about a concept (its definition, if there is one), blank out the concept on the front, and put the concept on the back.
4. **Quiz:** the same blanked sentence; options = the right concept + 3 other concepts. The browser scores it instantly and shows the original sentence as the explanation.
5. **Explain like a teacher:** every sentence that mentions the concept, as numbered steps.

*Why no ChatGPT-style AI?* It's free, instant, works offline, and every result can be explained. `lib/grading.js` and `lib/studyEngine.js` are the two places where a real AI model could be plugged in later.

## 6. Likely questions, with answers

1. **Why Express?** It's the standard minimal web framework for Node: routing plus middleware, nothing hidden.
2. **Why server-side rendering (EJS) and not React?** Simpler: one language, no build step, and the page arrives with its data already filled in. JavaScript is only used where the page must react instantly (clock, flip cards, quiz).
3. **How do you stop SQL injection?** With parameterized queries (`$1`). The database treats the values as data, never as SQL.
4. **How are passwords stored?** As bcrypt hashes (`bcryptjs`), never in plain text.
5. **What if two updates fail halfway?** They run inside a transaction, so `ROLLBACK` undoes everything.
6. **How does the app know who is logged in?** `express-session` stores the user in a session. The browser keeps the session id in a cookie.
7. **What is Elo?** The chess rating system. You gain more for beating a stronger opponent. Here the opponents are questions.
8. **Why does the question's rating change too?** If many people get it wrong it becomes "stronger" (harder). Difficulty adjusts itself.
9. **Where does the score of a quiz come from?** It's *computed* from the answers with SQL (`count(*) FILTER (WHERE is_correct)`), not stored. That avoids redundant data (3NF).
10. **What stops two correct options, or two coaches in one subject?** Database rules: an `EXCLUDE` constraint and a trigger. The database guarantees it even if the app has a bug.
11. **How is the next practice question chosen?** SQL R12: unseen questions, `ORDER BY abs(question_rating − my_rating)`, `LIMIT 1`.
12. **How does the duel know you ran out of time?** `public/duel.js` sets `timed_out=1` and submits; the server records `termination = 'TIMEOUT'`.
13. **Is user-pasted text safe?** Yes. It is HTML-escaped before display (`highlight()` and `<%= %>`), so a pasted `<script>` is just text.
14. **What's in `public/` vs `views/`?** `views` are templates the *server* fills in; `public` files are sent to the *browser* as they are.
15. **Why are tournaments not in the database yet?** They're a coming-soon feature, so their details live in a small config file. At launch we'd add `tournaments(tournament_id, name, subject_id, format, clock, starts_at, sponsor_college_id)` and `tournament_players(tournament_id, user_id, score)` (one row per player per event, 1:N on both sides).
16. **How would you scale it?** Add indexes for the slow queries (see the DBMS part), keep sessions in the database or Redis instead of memory, and run several Node processes.

## 7. Two-minute demo script

1. **Log in** with the demo account → you land on the **Workspace**.
2. Click the **Photosynthesis** sample → show the Summary, then **Key concepts** → click "glucose" → the teacher panel explains it.
3. **Flashcards** → flip two cards. **Practice quiz** → answer 2 questions (one wrong) → instant score + explanation.
4. Paste a paragraph of your own notes → **Generate study kit** → it works on any text.
5. **Practice** → show "You vs Question", answer → the rating changes, and a wrong answer goes into the **Mistake notebook**.
6. **Duels** → challenge a rival on **Blitz 3+2** → answer quickly → show the **scoresheet**.
7. **Focus timer** → start → **Take my chess break** → solve the puzzle (back-rank mate: queen or rook to the 8th rank).
8. Toggle **dark mode**. Finish on the **Dashboard**: ratings, chess titles, weak topics.

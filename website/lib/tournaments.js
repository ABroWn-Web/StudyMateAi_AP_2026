// lib/tournaments.js - the tournaments planned for launch ("coming soon").
// They are not in the database yet. When the feature goes live we add two tables:
//   tournaments(tournament_id, name, subject_id, format, base_seconds, increment_seconds, starts_at, sponsor_college_id)
//   tournament_players(tournament_id, user_id, score)        -- one row per player per tournament
module.exports = {
  launchesAt: '2026-12-05T18:00:00+05:30',
  list: [
    { name: 'StudyMate Championship · Season 1', subject: 'All subjects', format: 'Swiss · 7 rounds', clock: '10+0',
      starts: 'Sat 5 Dec, 6:00 PM', prize: 'Scholarship vouchers for the top 3', sponsor: 0 },
    { name: 'Physics Blitz Arena', subject: 'Physics', format: 'Arena · 60 min', clock: '3+2',
      starts: 'Sun 6 Dec, 7:00 PM', prize: 'Featured on the home page', sponsor: 1 },
    { name: 'Maths Bullet Sprint', subject: 'Maths', format: 'Arena · 30 min', clock: '1+0',
      starts: 'Mon 7 Dec, 8:00 PM', prize: 'Winner badge for a month', sponsor: 2 },
    { name: 'Chemistry Rapid Swiss', subject: 'Chemistry', format: 'Swiss · 5 rounds', clock: '10+0',
      starts: 'Wed 9 Dec, 6:30 PM', prize: 'Certificates for the top 10', sponsor: 3 },
    { name: 'Computer Science Knockout Cup', subject: 'Computer Science', format: 'Knockout · 32 players', clock: '5+0',
      starts: 'Sat 12 Dec, 5:00 PM', prize: 'Trophy + internship interview', sponsor: 4 },
    { name: 'Inter-University Team Battle', subject: 'All subjects', format: 'Team Arena · 90 min', clock: '3+2',
      starts: 'Sun 13 Dec, 6:00 PM', prize: 'Cup for the winning university', sponsor: 5 },
  ],
  formats: [
    ['Arena', 'Play as many duels as you can before time runs out. 2 points for a win, 1 for a draw; after two wins in a row every win counts double.'],
    ['Swiss', 'Every round you meet someone with the same score as you. Nobody is knocked out, and the highest total wins.'],
    ['Knockout', 'Lose a duel and you are out. The last player standing wins the cup.'],
  ],
};

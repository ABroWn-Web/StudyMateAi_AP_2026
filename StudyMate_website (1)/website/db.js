// db.js - the connection to PostgreSQL.
// A "pool" keeps a few connections open and lends one to each query.
// The username and password come from the same environment variables psql uses:
//   export PGUSER=postgres PGPASSWORD='your password'
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'studymate',
});

// All our tables live in the "studymate" schema (see dbms/03_schema.sql).
pool.on('connect', (client) => client.query('SET search_path TO studymate'));

// db.query(sql, [values]) -> returns the rows.
// $1, $2 ... in the SQL are filled with the values safely (no SQL injection).
async function query(sql, values = []) {
  const result = await pool.query(sql, values);
  return result.rows;
}

// db.transaction(async (client) => { ... }) runs several queries as ONE unit:
// if any of them fails, ROLLBACK undoes all of them (all-or-nothing).
async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, pool, transaction };

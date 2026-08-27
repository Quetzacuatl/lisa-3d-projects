const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Fout: DATABASE_URL is niet gedefinieerd in het .env bestand.");
  process.exit(1);
}

// Configuraties voor de database pool.
// SSL is vereist voor externe verbindingen met Supabase, met rejectUnauthorized: false voor compatibiliteit.
const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool
};

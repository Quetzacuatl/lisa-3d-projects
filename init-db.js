const db = require('./db');

const createTablesSql = `
  CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(10,2) DEFAULT 0.00,
    image_front TEXT NOT NULL,
    image_side TEXT,
    image_back TEXT,
    video_link VARCHAR(255),
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS analytics (
    key VARCHAR(255) PRIMARY KEY,
    value INTEGER DEFAULT 0
  );

  INSERT INTO analytics (key, value)
  VALUES ('homepage_views', 0)
  ON CONFLICT (key) DO NOTHING;
`;

async function init() {
  try {
    console.log("Database tabellen aanmaken in Supabase...");
    await db.query(createTablesSql);
    console.log("Database met succes geïnitialiseerd!");
    process.exit(0);
  } catch (err) {
    console.error("Fout bij het initialiseren van de database:", err);
    process.exit(1);
  }
}

init();

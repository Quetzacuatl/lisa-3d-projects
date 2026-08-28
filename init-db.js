const db = require('./db');

async function init() {
  try {
    console.log("Database tabellen aanmaken in Supabase...");

    console.log("1. Tabel 'products' controleren/aanmaken...");
    await db.query(`
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
    `);

    console.log("2. Tabel 'subscribers' controleren/aanmaken...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("3. Tabel 'analytics' controleren/aanmaken...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS analytics (
        key VARCHAR(255) PRIMARY KEY,
        value INTEGER DEFAULT 0
      );
    `);

    console.log("4. Tabel 'blog_posts' controleren/aanmaken...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        image TEXT,
        likes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("5. Analytics views initialiseren...");
    await db.query(`
      INSERT INTO analytics (key, value)
      VALUES ('homepage_views', 0)
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log("6. Blog_posts tabel migreren met extra afbeeldingen...");
    await db.query(`
      ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS image_2 TEXT;
    `);
    await db.query(`
      ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS image_3 TEXT;
    `);

    console.log("7. 'media_items' kolommen toevoegen voor onbeperkte foto's & video's...");
    await db.query(`
      ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS media_items TEXT;
    `);
    await db.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS media_items TEXT;
    `);

    console.log("Database met succes geïnitialiseerd!");
    process.exit(0);
  } catch (err) {
    console.error("Fout bij het initialiseren van de database:", err);
    process.exit(1);
  }
}

init();

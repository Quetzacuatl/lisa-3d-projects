const express = require('express');
const session = require('express-session');
const path = require('path');
const nodemailer = require('nodemailer');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// EJS instellen als template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files (CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Parser voor JSON en urlencoded form-data.
// Limiet verhoogd naar 30mb voor Base64 geüploade foto's en video's.
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ limit: '30mb', extended: true }));

// Sessies instellen voor de admin login
app.use(session({
  secret: process.env.SESSION_SECRET || 'lisa-secret-cookie-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // false is prima voor Render/local dev achter proxy
    maxAge: 24 * 60 * 60 * 1000 // 24 uur geldig
  }
}));

// Video link helper om YouTube/TikTok om te zetten naar embeds of bruikbare links
function getEmbedUrl(url) {
  if (!url) return null;
  
  // YouTube watch link
  const ytRegex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const ytMatch = url.match(ytRegex);
  if (ytMatch && ytMatch[2].length === 11) {
    return { type: 'youtube', url: `https://www.youtube.com/embed/${ytMatch[2]}` };
  }
  
  // TikTok links
  if (url.includes('tiktok.com')) {
    return { type: 'tiktok', url: url };
  }
  
  // Directe videobestanden (.mp4, etc)
  if (url.match(/\.(mp4|webm|ogg)$/i)) {
    return { type: 'raw', url: url };
  }
  
  return { type: 'link', url: url };
}

// Middleware om te controleren of de admin is ingelogd
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/admin/login');
}

// ----------------------------------------------------
// 🌐 CLIENT ROUTING (Bezoeker)
// ----------------------------------------------------

// 1. Homepage: Toon alle producten en registreer een view voor de homepage
app.get('/', async (req, res) => {
  try {
    // Homepage view ophogen
    await db.query(`
      INSERT INTO analytics (key, value) 
      VALUES ('homepage_views', 1) 
      ON CONFLICT (key) 
      DO UPDATE SET value = analytics.value + 1
    `);

    // Producten ophalen
    const productsRes = await db.query('SELECT * FROM products ORDER BY id DESC');
    
    // Video embed data toevoegen
    const products = productsRes.rows.map(p => {
      return {
        ...p,
        videoData: getEmbedUrl(p.video_link)
      };
    });

    // Blogberichten ophalen
    const blogRes = await db.query('SELECT * FROM blog_posts ORDER BY id DESC');

    res.render('index', { products, blogPosts: blogRes.rows });
  } catch (err) {
    console.error("Fout bij laden homepage:", err);
    res.status(500).send("Er is iets fout gegaan.");
  }
});

// 2. AJAX route om product-views te registreren bij openen bottom sheet
app.post('/api/products/:id/view', async (req, res) => {
  try {
    const productId = req.params.id;
    await db.query('UPDATE products SET views = views + 1 WHERE id = $1', [productId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Fout bij ophogen product view:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

// 2b. AJAX route om een blogbericht een hartje te geven
app.post('/api/blog/:id/like', async (req, res) => {
  try {
    const blogId = req.params.id;
    const result = await db.query('UPDATE blog_posts SET likes = likes + 1 WHERE id = $1 RETURNING likes', [blogId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Bericht niet gevonden." });
    }
    res.json({ success: true, likes: result.rows[0].likes });
  } catch (err) {
    console.error("Fout bij ophogen blog likes:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

// 3. Nieuwsbrief inschrijving
app.post('/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).send("Ongeldig e-mailadres.");
  }

  try {
    await db.query(
      'INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
      [email.trim().toLowerCase()]
    );
    res.redirect('/?subscribed=true');
  } catch (err) {
    console.error("Fout bij nieuwsbrief inschrijving:", err);
    res.redirect('/?subscribed=false');
  }
});

// ----------------------------------------------------
// 🔐 ADMIN ROUTING (Beheer)
// ----------------------------------------------------

// 1. Admin Login (GET)
app.get('/admin/login', (req, res) => {
  if (req.session.isAdmin) {
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: null });
});

// 2. Admin Login (POST)
app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  const configuredPassword = process.env.ADMIN_PASSWORD || 'lisa3dprint';

  if (password === configuredPassword) {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.render('admin/login', { error: 'Onjuist wachtwoord, probeer het opnieuw.' });
  }
});

// 3. Admin Logout
app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// 4. Admin Dashboard (Stats, Productenlijst, Abonnees)
app.get('/admin', requireAdmin, async (req, res) => {
  try {
    // 1. Totaal homepage views
    const homepageRes = await db.query("SELECT value FROM analytics WHERE key = 'homepage_views'");
    const totalViews = homepageRes.rows.length > 0 ? homepageRes.rows[0].value : 0;

    // 2. Productenlijst
    const productsRes = await db.query("SELECT id, title, views, price FROM products ORDER BY id DESC");

    // 3. Abonnees
    const subscribersRes = await db.query("SELECT email, created_at FROM subscribers ORDER BY id DESC");

    // 4. Blogberichten
    const blogRes = await db.query("SELECT id, title, likes, created_at FROM blog_posts ORDER BY id DESC");

    res.render('admin/dashboard', {
      totalViews,
      products: productsRes.rows,
      subscribers: subscribersRes.rows,
      blogPosts: blogRes.rows
    });
  } catch (err) {
    console.error("Fout bij laden admin dashboard:", err);
    res.status(500).send("Database fout.");
  }
});

// 5. Nieuw Product Toevoegen (GET)
app.get('/admin/products/new', requireAdmin, (req, res) => {
  res.render('admin/new-product');
});

// 6. Nieuw Product Opslaan (POST)
app.post('/admin/products/new', requireAdmin, async (req, res) => {
  const { title, description, price, media_items } = req.body;

  let parsedMedia = [];
  try {
    parsedMedia = JSON.parse(media_items || '[]');
  } catch(e) {
    console.error("Kon media_items niet parsen:", e);
  }

  // Automatische synchronisatie naar legacy kolommen voor 100% compatibiliteit
  const imagesOnly = parsedMedia.filter(m => m.type === 'image');
  const image_front = imagesOnly[0] ? imagesOnly[0].url : '';
  const image_side = imagesOnly[1] ? imagesOnly[1].url : null;
  const image_back = imagesOnly[2] ? imagesOnly[2].url : null;
  
  const videoItem = parsedMedia.find(m => m.type === 'video' || m.type === 'video_link');
  const video_link = videoItem ? videoItem.url : null;

  if (!title || !description || !image_front) {
    return res.status(400).send("Titel, beschrijving en minimaal één foto zijn verplicht.");
  }

  try {
    await db.query(
      `INSERT INTO products (title, description, price, image_front, image_side, image_back, video_link, media_items)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        title,
        description,
        parseFloat(price) || 0.00,
        image_front,
        image_side,
        image_back,
        video_link,
        media_items || '[]'
      ]
    );
    res.redirect('/admin');
  } catch (err) {
    console.error("Fout bij opslaan product:", err);
    res.status(500).send(`Fout bij opslaan in database: ${err.message}`);
  }
});

// 7. Product Bewerken (GET)
app.get('/admin/products/:id/edit', requireAdmin, async (req, res) => {
  try {
    const productRes = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (productRes.rows.length === 0) {
      return res.status(404).send("Product niet gevonden.");
    }
    res.render('admin/edit-product', { product: productRes.rows[0] });
  } catch (err) {
    console.error("Fout bij ophalen product:", err);
    res.status(500).send("Database fout.");
  }
});

// 8. Product Bewerken Opslaan (POST)
app.post('/admin/products/:id/edit', requireAdmin, async (req, res) => {
  const { title, description, price, media_items } = req.body;

  let parsedMedia = [];
  try {
    parsedMedia = JSON.parse(media_items || '[]');
  } catch(e) {
    console.error("Kon media_items niet parsen:", e);
  }

  // Automatische synchronisatie naar legacy kolommen voor 100% compatibiliteit
  const imagesOnly = parsedMedia.filter(m => m.type === 'image');
  const image_front = imagesOnly[0] ? imagesOnly[0].url : '';
  const image_side = imagesOnly[1] ? imagesOnly[1].url : null;
  const image_back = imagesOnly[2] ? imagesOnly[2].url : null;
  
  const videoItem = parsedMedia.find(m => m.type === 'video' || m.type === 'video_link');
  const video_link = videoItem ? videoItem.url : null;

  if (!title || !description || !image_front) {
    return res.status(400).send("Titel, beschrijving en minimaal één foto zijn verplicht.");
  }

  try {
    await db.query(
      `UPDATE products 
       SET title = $1, description = $2, price = $3, image_front = $4, image_side = $5, image_back = $6, video_link = $7, media_items = $8
       WHERE id = $9`,
      [
        title,
        description,
        parseFloat(price) || 0.00,
        image_front,
        image_side,
        image_back,
        video_link,
        media_items || '[]',
        req.params.id
      ]
    );
    res.redirect('/admin');
  } catch (err) {
    console.error("Fout bij updaten product:", err);
    res.status(500).send(`Fout bij updaten in database: ${err.message}`);
  }
});

// 9. Product Verwijderen (POST)
app.post('/admin/products/:id/delete', requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.redirect('/admin');
  } catch (err) {
    console.error("Fout bij verwijderen product:", err);
    res.status(500).send("Fout bij verwijderen.");
  }
});

// 10. Bestelpagina (GET)
app.get('/admin/orders/new', requireAdmin, async (req, res) => {
  try {
    // Lijst met producten voor de select-dropdown
    const productsRes = await db.query("SELECT id, title, price FROM products ORDER BY title ASC");
    res.render('admin/new-order', { products: productsRes.rows });
  } catch (err) {
    console.error("Fout bij laden bestelpagina:", err);
    res.status(500).send("Fout bij laden van producten.");
  }
});

// 11. Bestelmail versturen (POST JSON)
app.post('/admin/orders/send', requireAdmin, async (req, res) => {
  const { clientName, clientPhone, clientEmail, items } = req.body;

  if (!clientName || !clientPhone || !items || items.length === 0) {
    return res.status(400).json({ error: "Klantnaam, telefoonnummer en minimaal 1 product zijn verplicht." });
  }

  try {
    // Tekstuele samenvatting van de bestelling voor in de mail
    let productSummaryText = "";
    let copyPasteProductsText = "";
    let totalPrice = 0;

    for (let item of items) {
      const pId = item.productId;
      const productRes = await db.query("SELECT title, price FROM products WHERE id = $1", [pId]);
      
      if (productRes.rows.length > 0) {
        const product = productRes.rows[0];
        const itemPrice = parseFloat(product.price) || 0;
        const itemTotal = itemPrice * parseInt(item.quantity);
        totalPrice += itemTotal;

        productSummaryText += `- ${product.title} (Aantal: ${item.quantity}, Kleur: ${item.color})\n`;
        copyPasteProductsText += `- ${item.quantity}x ${product.title} (Kleur: ${item.color})\n`;
      } else {
        productSummaryText += `- Onbekend product ID ${pId} (Aantal: ${item.quantity}, Kleur: ${item.color})\n`;
        copyPasteProductsText += `- ${item.quantity}x Onbekend product (Kleur: ${item.color})\n`;
      }
    }

    // Bericht voorbereiden voor de WhatsApp URL
    const whatsappBaseText = `Hoi ${clientName}, super leuk dat je interesse hebt in mijn 3D-prints! Ik heb je bestelling genoteerd:\n${copyPasteProductsText}\nTotaalbedrag: €${totalPrice.toFixed(2)}\n\nJe kunt betalen via deze betaallink:\n[Betaallink invoegen]\n\nZodra ik de betaling heb ontvangen ga ik voor je printen!`;
    const encodedWhatsappText = encodeURIComponent(whatsappBaseText);
    
    // Landcode regelen voor whatsapp link (verwijder 0 aan begin, zet 32 of 31 ervoor indien nodig)
    let formattedPhone = clientPhone.replace(/[\s\-\(\)]/g, '');
    if (formattedPhone.startsWith('0')) {
      // Standaard Belgische/Nederlandse nummerconversie (stel +32/België in als standaard, of +31/NL op basis van lengte of invoer)
      // We nemen +32 aan tenzij het op een NL mobiel nummer lijkt (06...)
      if (formattedPhone.startsWith('06') && formattedPhone.length === 10) {
        formattedPhone = '31' + formattedPhone.substring(1);
      } else {
        formattedPhone = '32' + formattedPhone.substring(1);
      }
    } else if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1);
    }
    const whatsappLink = `https://wa.me/${formattedPhone}?text=${encodedWhatsappText}`;

    // E-mail inhoud opstellen
    const emailBody = `Hallo Lisa,

Je hebt zojuist een nieuwe bestelling genoteerd!

KLANTGEGEVENS:
- Naam: ${clientName}
- Telefoonnummer: ${clientPhone}
- E-mailadres: ${clientEmail || 'Niet opgegeven'}

BESTELDE PRODUCTEN:
${productSummaryText}
Richtprijs Totaal: €${totalPrice.toFixed(2)}

--------------------------------------------------
KANT-EN-KLAAR BERICHT VOOR DE KLANT:
(Kopieer en stuur via WhatsApp of e-mail)

${whatsappBaseText}
--------------------------------------------------

Snelkoppeling om direct een WhatsApp chat te openen met ${clientName}:
${whatsappLink}

Succes met printen!`;

    // Mail config controleren
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_PASS;
    const adminEmail = process.env.ADMIN_EMAIL || gmailUser;

    if (!gmailUser || !gmailPass) {
      console.warn("E-mail niet verzonden: GMAIL_USER of GMAIL_PASS ontbreekt in .env");
      return res.json({ 
        success: true, 
        warning: "Bestelling genoteerd, maar e-mail kon niet worden verzonden omdat de mail-instellingen (.env) niet zijn ingevuld.",
        whatsappLink 
      });
    }

    // Nodemailer transporter aanmaken
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass
      }
    });

    const mailOptions = {
      from: `Lisa 3D Prints <${gmailUser}>`,
      to: adminEmail,
      subject: `Bestelling aanvraag ${clientName}`,
      text: emailBody
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, whatsappLink });
  } catch (err) {
    console.error("Fout bij verwerken bestelmail:", err);
    res.status(500).json({ error: "Fout bij verwerken van de bestelling." });
  }
});

// ----------------------------------------------------
// 📝 ADMIN BLOG ROUTES
// ----------------------------------------------------

// 1. Nieuw Blogbericht aanmaken (GET)
app.get('/admin/blog/new', requireAdmin, (req, res) => {
  res.render('admin/new-blog');
});

// 2. Nieuw Blogbericht opslaan (POST)
app.post('/admin/blog/new', requireAdmin, async (req, res) => {
  const { title, content, media_items } = req.body;

  if (!title || !content) {
    return res.status(400).send("Titel en inhoud zijn verplicht.");
  }

  let parsedMedia = [];
  try {
    parsedMedia = JSON.parse(media_items || '[]');
  } catch(e) {
    console.error("Kon media_items niet parsen:", e);
  }

  // Automatische synchronisatie naar legacy kolommen voor 100% compatibiliteit
  const imagesOnly = parsedMedia.filter(m => m.type === 'image');
  const image = imagesOnly[0] ? imagesOnly[0].url : '';
  const image_2 = imagesOnly[1] ? imagesOnly[1].url : null;
  const image_3 = imagesOnly[2] ? imagesOnly[2].url : null;

  console.log("=== BLOG CREATE DIAGNOSTIEK ===");
  console.log("Title:", title);
  console.log("Content lengte:", content ? content.length : 0);
  console.log("Media items aantal:", parsedMedia.length);

  try {
    await db.query(
      `INSERT INTO blog_posts (title, content, image, image_2, image_3, media_items)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [title, content, image || null, image_2 || null, image_3 || null, media_items || '[]']
    );
    console.log("Nieuw blogbericht succesvol opgeslagen!");
    res.redirect('/admin');
  } catch (err) {
    console.error("Fout bij opslaan blogbericht:", err);
    res.status(500).send(`Fout bij opslaan in database: ${err.message}`);
  }
});

// 3. Blogbericht bewerken (GET)
app.get('/admin/blog/:id/edit', requireAdmin, async (req, res) => {
  try {
    const blogRes = await db.query('SELECT * FROM blog_posts WHERE id = $1', [req.params.id]);
    if (blogRes.rows.length === 0) {
      return res.status(404).send("Blogbericht niet gevonden.");
    }
    res.render('admin/edit-blog', { blog: blogRes.rows[0] });
  } catch (err) {
    console.error("Fout bij ophalen blogbericht:", err);
    res.status(500).send("Database fout.");
  }
});

// 4. Blogbericht bewerken opslaan (POST)
app.post('/admin/blog/:id/edit', requireAdmin, async (req, res) => {
  const { title, content, media_items } = req.body;

  let parsedMedia = [];
  try {
    parsedMedia = JSON.parse(media_items || '[]');
  } catch(e) {
    console.error("Kon media_items niet parsen:", e);
  }

  // Automatische synchronisatie naar legacy kolommen voor 100% compatibiliteit
  const imagesOnly = parsedMedia.filter(m => m.type === 'image');
  const image = imagesOnly[0] ? imagesOnly[0].url : '';
  const image_2 = imagesOnly[1] ? imagesOnly[1].url : null;
  const image_3 = imagesOnly[2] ? imagesOnly[2].url : null;

  console.log("=== BLOG UPDATE DIAGNOSTIEK ===");
  console.log("ID:", req.params.id);
  console.log("Title:", title);
  console.log("Content lengte:", content ? content.length : 0);
  console.log("Media items aantal:", parsedMedia.length);

  try {
    const result = await db.query(
      `UPDATE blog_posts 
       SET title = $1, content = $2, image = $3, image_2 = $4, image_3 = $5, media_items = $6 
       WHERE id = $7`,
      [title, content, image || null, image_2 || null, image_3 || null, media_items || '[]', req.params.id]
    );
    console.log("Update query succesvol uitgevoerd!", result.rowCount, "rijen beïnvloed.");
    res.redirect('/admin');
  } catch (err) {
    console.error("Fout bij updaten blogbericht:", err);
    res.status(500).send(`Fout bij updaten in database: ${err.message}`);
  }
});

// 5. Blogbericht verwijderen (POST)
app.post('/admin/blog/:id/delete', requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM blog_posts WHERE id = $1', [req.params.id]);
    res.redirect('/admin');
  } catch (err) {
    console.error("Fout bij verwijderen blogbericht:", err);
    res.status(500).send("Fout bij verwijderen.");
  }
});

// Server starten
app.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});

# Lisa's 3D Studio - Portfolio & Admin Dashboard

Een minimalistische, chique en ontzettend snelle mobiel-vriendelijke portfolio-website ontworpen voor Lisa's 3D-print studio. Perfect afgestemd op haar NFC-sleutelhanger!

## 🌟 Kenmerken

- **Mobiel-Eerst Ontwerp**: Ontworpen als een native mobiele app met een chique donker/warm boutique thema.
- **Native-feel Drawer (Bottom Sheet)**: Productdetails schuiven vloeiend omhoog vanaf de onderkant van het scherm voor een comfortabele bediening met de duim.
- **Interactieve Fotogalerij**: Bezoekers kunnen door voor-, zij- en achter-aanzichten van producten bladeren.
- **TikTok & YouTube Video Embeds**: Toon direct filmpjes waarin het geprinte product gedemonstreerd wordt.
- **Geautomatiseerde Analytics**: Houdt het totale aantal homepagebezoeken bij en de individuele views per product.
- **Nieuwsbrief**: Bezoekers kunnen hun e-mailadres achterlaten. De admin kan de complete lijst met één klik kopiëren (gescheiden door komma's) om direct in Gmail (BCC) te plakken.
- **Bestelassistent (Multi-Product)**: Lisa kan tijdens een fysieke ontmoeting (via de NFC-tag) direct een bestelling noteren voor een klant. Ze vult de klantnaam, telefoonnummer en e-mail in, selecteert meerdere producten met kleur en aantal, en verstuurt deze.
- **Slimme WhatsApp & E-mail Flow**:
  - Er wordt direct een e-mail naar Lisa gestuurd met alle bestelgegevens.
  - De website toont direct een knop waarmee Lisa met **één tik** een WhatsApp-gesprek opent met de klant, inclusief een vooraf ingevuld bericht met de bestelling, totaalprijs en betaalinstructies!

---

## 🛠️ Lokale Setup (Ontwikkeling)

### 1. Vereisten
Zorg ervoor dat je [Node.js](https://nodejs.org/) geïnstalleerd hebt.

### 2. Project installeren
Download de code en installeer de benodigde bibliotheken:
```bash
npm install
```

### 3. Omgevingsvariabelen instellen
Maak een nieuw bestand genaamd `.env` in de hoofdmap van het project en kopieer de inhoud van `.env.example`. Vul de benodigde gegevens in:

- `DATABASE_URL`: De connectielink naar je Supabase PostgreSQL database (zie hieronder).
- `ADMIN_PASSWORD`: Het wachtwoord dat Lisa invoert om in te loggen op haar `/admin` pagina.
- `GMAIL_USER`: Lisa's Gmail-adres.
- `GMAIL_PASS`: Een Gmail **App-wachtwoord** (zie instructie hieronder).

### 4. Database Initialiseren
Voer het initialisatiescript uit om de tabellen in Supabase aan te maken:
```bash
npm run init-db
```

### 5. Lokaal opstarten
Start de server op:
```bash
npm start
```
De website is nu lokaal beschikbaar op [http://localhost:3000](http://localhost:3000).

---

## ☁️ Productie Setup (Gratis Hosting)

Dit project is zo ontworpen dat het **volledig gratis** te hosten is met een cloud-database.

### Stap 1: Supabase Setup (Gratis Database)
1. Ga naar [Supabase.com](https://supabase.com/) en maak een gratis account aan.
2. Maak een nieuw project aan (kies een regio dichtbij, bijv. Frankfurt).
3. Ga in je Supabase dashboard naar **Project Settings** (tandwiel icoon links) -> **Database**.
4. Scroll naar beneden naar **Connection string**, kies de tab **URI** (of Node.js) en kopieer deze link.
5. Vervang `[YOUR-PASSWORD]` in de link door het wachtwoord dat je hebt gekozen bij het aanmaken van je Supabase-project.
6. Plak deze link in je `.env` bestand als `DATABASE_URL`.

### Stap 2: Gmail App-Wachtwoord Genereren
Nodemailer heeft een beveiligd wachtwoord nodig om namens Lisa mails te mogen sturen. Haar normale wachtwoord werkt hier niet.
1. Ga naar Lisa's Google-account instellingen ([myaccount.google.com](https://myaccount.google.com/)).
2. Zorg ervoor dat **2-stapsverificatie** (2-Step Verification) is ingeschakeld onder het menu **Beveiliging** (Security).
3. Zoek bovenaan in de zoekbalk naar `"App-wachtwoorden"` (of `"App passwords"`).
4. Voer een naam in (bijv. `"Lisa 3D Prints"`) en klik op **Maken**.
5. Google toont nu een unieke code van 16 letters (bijv. `abcd efgh ijkl mnop`). Kopieer deze code.
6. Plak deze code **zonder spaties** in je `.env` bestand als `GMAIL_PASS`.

### Stap 3: Render.com Setup (Gratis Webhosting)
1. Maak een gratis account aan op [Render.com](https://render.com/).
2. Klik op **New +** en kies **Web Service**.
3. Koppel je GitHub repository waarin je deze code hebt geüpload.
4. Voer de volgende instellingen in:
   - **Language**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Scroll naar beneden en klik op **Advanced** -> **Add Environment Variable**. Voeg hier alle variabelen uit je `.env` bestand toe:
   - `DATABASE_URL` (De Supabase URI)
   - `SESSION_SECRET` (Willekeurige tekst)
   - `ADMIN_PASSWORD` (Lisa's gekozen admin wachtwoord)
   - `GMAIL_USER` (Lisa's Gmail)
   - `GMAIL_PASS` (Het 16-letterige Google App-wachtwoord)
   - `ADMIN_EMAIL` (Lisa's Gmail)
6. Klik op **Create Web Service**. Render gaat nu de website bouwen en online zetten!

> 💡 **Belangrijk na de eerste deploy**: Zodra de service op Render actief is, open je de **Shell** in het Render dashboard en voer je eenmalig het commando `npm run init-db` uit om de database-tabellen op Supabase te genereren. Je kunt dit commando ook toevoegen aan je Render Build Command: `npm install && npm run init-db`.

---

## 📸 Waarom Base64 Afbeeldingsopslag?

Omdat Render's gratis tier een *ephemeral* (tijdelijk) bestandssysteem heeft, worden lokaal opgeslagen bestanden gewist bij elke herstart van de server. 

Om dit op te lossen en de site **100% gratis** te houden, worden foto's opgeslagen in de Supabase-database. Om te voorkomen dat de gratis database volraakt, is er een slimme client-side optimalisatie ingebouwd:
- Wanneer Lisa een foto van haar 3D-print uploadt, wordt deze **direct in haar browser** via een HTML5 Canvas verkleind tot maximaal 800 pixels breed/hoog en gecomprimeerd als JPEG (kwaliteit 0.85).
- Pas na deze compressie wordt de afbeelding als een compacte Base64-string naar de server gestuurd. Dit zorgt voor razendsnelle uploads en een minimaal databaseverbruik!

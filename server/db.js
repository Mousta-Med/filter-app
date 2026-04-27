const fs = require("node:fs");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();

// This file keeps all SQLite logic in one place.
// We use simple SQL queries (no ORM) and small helper functions.

function resolveDbPath() {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH;

  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) return path.join(home, "filter-app-data", "filters.sqlite");

  return path.join(__dirname, "data", "filters.sqlite");
}

const dbPath = resolveDbPath();
const dataDir = path.dirname(dbPath);

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function openDb() {
  ensureDataDir();
  return new sqlite3.Database(dbPath);
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function initDb(db) {
  // Create the table if it doesn't exist yet.
  await run(
    db,
    `
    CREATE TABLE IF NOT EXISTS filters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      depth REAL,
      description TEXT NOT NULL
    )
    `.trim()
  );

  // Seed 5 sample filters if the table is empty.
  const row = await get(db, "SELECT COUNT(*) AS count FROM filters");
  if (row && row.count > 0) return;

  const samples = [
    {
      reference: "MANN-C-30-100",
      name: "Cabin Air Filter C 30 100",
      brand: "MANN-FILTER",
      width: 300,
      height: 200,
      depth: 35,
      description: "Cabin air filter for cleaner air inside the vehicle."
    },
    {
      reference: "BOSCH-OF-250-150",
      name: "Oil Filter Standard",
      brand: "Bosch",
      width: 75,
      height: 100,
      depth: null,
      description: "Basic oil filter for everyday driving conditions."
    },
    {
      reference: "MAHLE-AF-400-250",
      name: "Engine Air Filter",
      brand: "MAHLE",
      width: 400,
      height: 250,
      depth: 50,
      description: "High airflow engine air filter, helps protect the engine."
    },
    {
      reference: "FRAM-CA-330-180",
      name: "Cabin Air Filter Premium",
      brand: "FRAM",
      width: 330,
      height: 180,
      depth: 30,
      description: "Premium cabin filter with odor reduction."
    },
    {
      reference: "K&N-AF-380-240",
      name: "Reusable Air Filter",
      brand: "K&N",
      width: 380,
      height: 240,
      depth: 45,
      description: "Washable and reusable air filter for long-term use."
    }
  ];

  for (const f of samples) {
    await run(
      db,
      `
      INSERT INTO filters (reference, name, brand, width, height, depth, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `.trim(),
      [f.reference, f.name, f.brand, f.width, f.height, f.depth, f.description]
    );
  }
}

module.exports = {
  openDb,
  initDb,
  run,
  get,
  all
};

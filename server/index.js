const express = require("express");
const cors = require("cors");
const fs = require("node:fs");
const path = require("node:path");

const { openDb, initDb, run, all } = require("./db");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

async function main() {
  const app = express();
  const db = openDb();
  await initDb(db);

  // In dev, the React app runs on Vite (usually http://localhost:5173).
  // If you use the Vite proxy (recommended here), CORS isn't strictly needed,
  // but keeping it enabled helps if you call the API directly.
  app.use(
    cors({
      origin: [/^http:\/\/localhost:\d+$/],
      credentials: false
    })
  );
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  // POST /filters -> add a new filter
  app.post("/filters", async (req, res) => {
    try {
      const {
        reference,
        name,
        brand,
        width,
        height,
        depth = null,
        description
      } = req.body ?? {};

      // Basic beginner-friendly validation
      if (!reference || !name || !brand || !description) {
        return res.status(400).json({
          error: "reference, name, brand, and description are required"
        });
      }

      const widthNumber = Number(width);
      const heightNumber = Number(height);
      const depthNumber = depth === null || depth === "" ? null : Number(depth);

      if (Number.isNaN(widthNumber) || Number.isNaN(heightNumber)) {
        return res.status(400).json({ error: "width and height must be numbers" });
      }
      if (depthNumber !== null && Number.isNaN(depthNumber)) {
        return res.status(400).json({ error: "depth must be a number (or empty)" });
      }

      const result = await run(
        db,
        `
        INSERT INTO filters (reference, name, brand, width, height, depth, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `.trim(),
        [
          String(reference).trim(),
          String(name).trim(),
          String(brand).trim(),
          widthNumber,
          heightNumber,
          depthNumber,
          String(description).trim()
        ]
      );

      const created = await all(db, "SELECT * FROM filters WHERE id = ?", [
        result.lastID
      ]);
      return res.status(201).json(created[0]);
    } catch (err) {
      if (err && err.code === "SQLITE_CONSTRAINT") {
        return res
          .status(409)
          .json({ error: "reference must be unique (already exists)" });
      }
      console.error(err);
      return res.status(500).json({ error: "internal server error" });
    }
  });

  // PUT /filters/:id -> update an existing filter
  app.put("/filters/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "id must be an integer" });
      }

      const {
        reference,
        name,
        brand,
        width,
        height,
        depth = null,
        description
      } = req.body ?? {};

      if (!reference || !name || !brand || !description) {
        return res.status(400).json({
          error: "reference, name, brand, and description are required"
        });
      }

      const widthNumber = Number(width);
      const heightNumber = Number(height);
      const depthNumber = depth === null || depth === "" ? null : Number(depth);

      if (Number.isNaN(widthNumber) || Number.isNaN(heightNumber)) {
        return res.status(400).json({ error: "width and height must be numbers" });
      }
      if (depthNumber !== null && Number.isNaN(depthNumber)) {
        return res.status(400).json({ error: "depth must be a number (or empty)" });
      }

      const result = await run(
        db,
        `
        UPDATE filters
        SET reference = ?, name = ?, brand = ?, width = ?, height = ?, depth = ?, description = ?
        WHERE id = ?
        `.trim(),
        [
          String(reference).trim(),
          String(name).trim(),
          String(brand).trim(),
          widthNumber,
          heightNumber,
          depthNumber,
          String(description).trim(),
          id
        ]
      );

      if (result.changes === 0) {
        return res.status(404).json({ error: "filter not found" });
      }

      const updated = await all(db, "SELECT * FROM filters WHERE id = ?", [id]);
      return res.json(updated[0]);
    } catch (err) {
      if (err && err.code === "SQLITE_CONSTRAINT") {
        return res
          .status(409)
          .json({ error: "reference must be unique (already exists)" });
      }
      console.error(err);
      return res.status(500).json({ error: "internal server error" });
    }
  });

  // DELETE /filters/:id -> delete a filter
  app.delete("/filters/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "id must be an integer" });
      }

      const result = await run(db, "DELETE FROM filters WHERE id = ?", [id]);
      if (result.changes === 0) {
        return res.status(404).json({ error: "filter not found" });
      }

      return res.status(204).send();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "internal server error" });
    }
  });

  // GET /filters -> get all filters
  app.get("/filters", async (req, res) => {
    try {
      const rows = await all(db, "SELECT * FROM filters ORDER BY id DESC");
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  // GET /filters/search -> filter by brand/width/height/keyword
  // Example: /filters/search?brand=Bosch&width=75&height=100&keyword=oil
  app.get("/filters/search", async (req, res) => {
    try {
      const { brand, width, height, keyword } = req.query ?? {};

      const where = [];
      const params = [];

      if (brand) {
        where.push("brand = ? COLLATE NOCASE");
        params.push(String(brand).trim());
      }

      if (width !== undefined && width !== "") {
        const widthNumber = Number(width);
        if (Number.isNaN(widthNumber)) {
          return res.status(400).json({ error: "width must be a number" });
        }
        where.push("width = ?");
        params.push(widthNumber);
      }

      if (height !== undefined && height !== "") {
        const heightNumber = Number(height);
        if (Number.isNaN(heightNumber)) {
          return res.status(400).json({ error: "height must be a number" });
        }
        where.push("height = ?");
        params.push(heightNumber);
      }

      if (keyword) {
        where.push(
          "(name LIKE ? COLLATE NOCASE OR description LIKE ? COLLATE NOCASE)"
        );
        const pattern = `%${String(keyword).trim()}%`;
        params.push(pattern, pattern);
      }

      const sql = `
        SELECT * FROM filters
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY id DESC
      `.trim();

      const rows = await all(db, sql, params);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  const clientDir = path.join(__dirname, "public");
  const clientIndexPath = path.join(clientDir, "index.html");

  if (fs.existsSync(clientIndexPath)) {
    app.use(express.static(clientDir));
    app.get("*", (req, res) => {
      res.sendFile(clientIndexPath);
    });
  }

  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

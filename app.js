const express = require("express");

const app = express();
const PORT = 3000;

// Starting data from the Week 1 instructions. The array lives in the memory of
// this Node.js process, so every change is lost when the server stops.
let movies = [
  {
    id: 1,
    title: "Inception",
    director: "Christopher Nolan",
    year: 2010,
  },
  {
    id: 2,
    title: "The Matrix",
    director: "The Wachowskis",
    year: 1999,
  },
  {
    id: 3,
    title: "Parasite",
    director: "Bong Joon-ho",
    year: 2019,
  },
];

// Id for the next new movie. A counter instead of movies.length + 1: after a
// delete, length + 1 can repeat an id that is still in use, and a deleted
// movie's id should never be given to a different movie.
let nextId = Math.max(...movies.map((movie) => movie.id)) + 1;

const FIRST_FILM_YEAR = 1888; // Roundhay Garden Scene, the oldest surviving film
const LAST_ALLOWED_YEAR = new Date().getFullYear() + 10;

/* ---------- Helpers ---------- */

function findMovie(id) {
  return movies.find((movie) => movie.id === Number(id));
}

const isMissing = (value) =>
  value === undefined || value === null || String(value).trim() === "";

const isText = (value) => typeof value === "string" && value.trim() !== "";

function isYear(value) {
  if (typeof value !== "number" && typeof value !== "string") return false;
  const year = Number(value);
  return (
    Number.isInteger(year) &&
    year >= FIRST_FILM_YEAR &&
    year <= LAST_ALLOWED_YEAR
  );
}

// Returns an error message, or null when the body is valid.
// POST needs a complete movie; PATCH (partial) checks only the fields sent.
function movieBodyError(body, partial) {
  const { title, director, year } = body;

  if (!partial && [title, director, year].some(isMissing)) {
    return "title, director and year are required";
  }
  if (partial && [title, director, year].every((v) => v === undefined)) {
    return "send at least one of title, director or year";
  }
  if (title !== undefined && !isText(title)) {
    return "title must be a non-empty string";
  }
  if (director !== undefined && !isText(director)) {
    return "director must be a non-empty string";
  }
  if (year !== undefined && !isYear(year)) {
    return `year must be a whole number between ${FIRST_FILM_YEAR} and ${LAST_ALLOWED_YEAR}`;
  }
  return null;
}

// Copies only the known fields, so extra properties in the request body
// never end up in the stored movie.
function pickMovieFields({ title, director, year }) {
  const fields = {};
  if (title !== undefined) fields.title = title.trim();
  if (director !== undefined) fields.director = director.trim();
  if (year !== undefined) fields.year = Number(year);
  return fields;
}

/* ---------- Middleware ---------- */

// Validator middleware: stops the request with 400 before it reaches the
// route handler if the movie data is not acceptable.
function validateMovie({ partial = false } = {}) {
  return (req, res, next) => {
    const error = movieBodyError(req.body ?? {}, partial);
    if (error) {
      return res.status(400).json({ error });
    }
    next();
  };
}

// Logger middleware: prints one line per request when the response is sent,
// for example "16:27:46  POST   /movies         201  8.2 ms".
function logger(req, res, next) {
  const start = performance.now();
  res.on("finish", () => {
    if (process.env.NODE_ENV === "test") return;
    const time = new Date().toLocaleTimeString("en-GB");
    const ms = (performance.now() - start).toFixed(1);
    console.log(
      `${time}  ${req.method.padEnd(7)}${req.originalUrl.padEnd(16)}${res.statusCode}  ${ms} ms`,
    );
  });
  next();
}

// The logger comes before express.json() so that it also sees requests the
// JSON parser rejects.
app.use(logger);
app.use(express.json());

/* ---------- Routes ---------- */

// GET /movies -> 200 OK with every movie
app.get("/movies", (req, res) => {
  res.json(movies);
});

// GET /movies/:id -> 200 OK with one movie, or 404 Not Found
app.get("/movies/:id", (req, res) => {
  const movie = findMovie(req.params.id);

  if (!movie) {
    return res.status(404).json({ error: "Movie not found" });
  }

  res.json(movie);
});

// POST /movies -> 201 Created with the new movie, or 400 Bad Request
app.post("/movies", validateMovie(), (req, res) => {
  const movie = { id: nextId++, ...pickMovieFields(req.body) };

  movies.push(movie);
  res.status(201).json(movie);
});

// Bonus: PATCH /movies/:id -> 200 OK with the updated movie, 400 or 404
app.patch("/movies/:id", validateMovie({ partial: true }), (req, res) => {
  const movie = findMovie(req.params.id);

  if (!movie) {
    return res.status(404).json({ error: "Movie not found" });
  }

  Object.assign(movie, pickMovieFields(req.body));
  res.json(movie);
});

// Bonus: DELETE /movies/:id -> 204 No Content, or 404 Not Found
app.delete("/movies/:id", (req, res) => {
  const movie = findMovie(req.params.id);

  if (!movie) {
    return res.status(404).json({ error: "Movie not found" });
  }

  movies = movies.filter((m) => m.id !== movie.id);
  res.status(204).end();
});

/* ---------- Errors ---------- */

// No route matched -> JSON 404 instead of Express's default HTML page
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// Error-handling middleware (four arguments). express.json() ends up here
// when the request body is not valid JSON.
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

/* ---------- Start ---------- */

// Start listening only when run with `node app.js`, so tests can import the app.
if (require.main === module) {
  app.listen(PORT, (error) => {
    if (error) throw error;
    console.log(`Movie API running at http://localhost:${PORT}/movies`);
    console.log(`${movies.length} movies in memory, process ${process.pid}`);
  });
}

module.exports = app;

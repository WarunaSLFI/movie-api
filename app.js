const express = require("express");
const morgan = require("morgan");

const app = express();
const PORT = 3000;

// The movie data still lives in the memory of this Node.js process (a
// JavaScript array), so every change is lost when the server stops.
// Week 2 data model: the server creates the id, the client sends
// title, year and genre.
let movies = [
  { id: 1, title: "Inception", year: 2010, genre: "Sci-Fi" },
  { id: 2, title: "The Matrix", year: 1999, genre: "Sci-Fi" },
  { id: 3, title: "Parasite", year: 2019, genre: "Thriller" },
  { id: 4, title: "Interstellar", year: 2014, genre: "Sci-Fi" },
  { id: 5, title: "Spirited Away", year: 2001, genre: "Animation" },
];

// Id for the next new movie. A counter instead of movies.length + 1: after a
// delete, length + 1 could repeat an id that is still in use.
let nextId = Math.max(...movies.map((movie) => movie.id)) + 1;

const FIRST_FILM_YEAR = 1888; // Roundhay Garden Scene, the oldest surviving film
const MOVIE_FIELDS = ["title", "year", "genre"];
const SORT_OPTIONS = ["year", "title"];

/* ---------- Helpers ---------- */

function findMovie(id) {
  return movies.find((movie) => movie.id === Number(id));
}

// Every error response has the same shape:
// { "error": { "code": "...", "message": "...", "details": [...] } }
function errorBody(code, message, details) {
  const error = { code, message };
  if (details) error.details = details;
  return { error };
}

function sendMovieNotFound(res) {
  return res.status(404).json(errorBody("MOVIE_NOT_FOUND", "Movie not found"));
}

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

/* ---------- Validation (Task 2) ---------- */

// Returns a list of validation errors. An empty list means the body is valid.
//   partial = false -> POST and PUT: title, year and genre are all required.
//   partial = true  -> PATCH: only the properties that are sent are checked.
// Every check compares with undefined instead of using a truthy/falsy test,
// because values such as "" or 0 were sent by the client and must be
// validated, not treated as "missing".
function validateMovie(body, partial = false) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return ["request body must be a JSON object"];
  }

  const errors = [];
  const maximumYear = new Date().getFullYear() + 5;

  if (!partial && body.title === undefined) {
    errors.push("title is required");
  }
  if (body.title !== undefined && !isNonEmptyString(body.title)) {
    errors.push("title must be a non-empty string");
  }

  if (!partial && body.year === undefined) {
    errors.push("year is required");
  }
  if (
    body.year !== undefined &&
    (!Number.isInteger(body.year) ||
      body.year < FIRST_FILM_YEAR ||
      body.year > maximumYear)
  ) {
    errors.push(
      `year must be an integer between ${FIRST_FILM_YEAR} and ${maximumYear}`,
    );
  }

  if (!partial && body.genre === undefined) {
    errors.push("genre is required");
  }
  if (body.genre !== undefined && !isNonEmptyString(body.genre)) {
    errors.push("genre must be a non-empty string");
  }

  // A PATCH that contains none of the movie properties would change nothing.
  if (partial && MOVIE_FIELDS.every((field) => body[field] === undefined)) {
    errors.push("send at least one of title, year or genre");
  }

  return errors;
}

// Copies only the known properties, so extra properties in the request body
// (for example an "id") never end up in the stored movie.
function movieFields(body) {
  const fields = {};
  if (body.title !== undefined) fields.title = body.title.trim();
  if (body.year !== undefined) fields.year = body.year;
  if (body.genre !== undefined) fields.genre = body.genre.trim();
  return fields;
}

// Validates the query parameters of GET /movies (Task 3).
function validateMovieQuery({ genre, minYear, sort }) {
  const errors = [];

  // A repeated parameter (?genre=a&genre=b) arrives as an array, not a string.
  if (genre !== undefined && !isNonEmptyString(genre)) {
    errors.push("genre must be a non-empty value, for example ?genre=Sci-Fi");
  }
  if (
    minYear !== undefined &&
    !(typeof minYear === "string" && /^\d+$/.test(minYear.trim()))
  ) {
    errors.push("minYear must be a whole number, for example ?minYear=2000");
  }
  if (sort !== undefined && !SORT_OPTIONS.includes(sort)) {
    errors.push(`sort must be one of: ${SORT_OPTIONS.join(", ")}`);
  }

  return errors;
}

/* ---------- Middleware (Task 4) ---------- */

// Task 4.2: a first, hand-written logger. It runs for every request before
// the routes, prints the method and URL and hands the request on with next().
// It is disabled because Morgan does the same job (and more). Start the server
// with `node app.js --simple-logger` to switch it back on and compare.
function simpleLogger(req, res, next) {
  console.log(req.method, req.originalUrl);
  next();
}

// Route-level middleware: runs validateMovie() before the route handler and
// stops the request with 400 if the movie data is invalid.
function requireValidMovie(partial) {
  return (req, res, next) => {
    const errors = validateMovie(req.body ?? {}, partial);
    if (errors.length > 0) {
      return res
        .status(400)
        .json(errorBody("VALIDATION_ERROR", "Movie data is invalid", errors));
    }
    next();
  };
}

if (process.argv.includes("--simple-logger")) {
  app.use(simpleLogger);
}

// Morgan is registered before express.json() on purpose: if the JSON parser
// rejects a broken body, Express jumps straight to the error handler and any
// middleware registered after express.json() is skipped. Registered first,
// Morgan also logs those 400 responses.
app.use(morgan("dev", { skip: () => process.env.NODE_ENV === "test" }));
app.use(express.json());

/* ---------- Routes ---------- */

// GET /movies -> 200 OK with every movie, or the filtered/sorted list
// Optional query parameters: genre, minYear, sort (year | title)
app.get("/movies", (req, res) => {
  const errors = validateMovieQuery(req.query);
  if (errors.length > 0) {
    return res
      .status(400)
      .json(errorBody("INVALID_QUERY", "Query parameters are invalid", errors));
  }

  const { genre, minYear, sort } = req.query;

  // Work on a copy: sort() changes the array it is called on, and the stored
  // movies array must keep its original order.
  let result = [...movies];

  if (genre !== undefined) {
    const wanted = genre.trim().toLowerCase();
    result = result.filter((movie) => movie.genre.toLowerCase() === wanted);
  }
  if (minYear !== undefined) {
    result = result.filter((movie) => movie.year >= Number(minYear));
  }
  if (sort === "year") {
    result.sort((a, b) => a.year - b.year);
  }
  if (sort === "title") {
    result.sort((a, b) => a.title.localeCompare(b.title, "en"));
  }

  res.json(result); // an empty array is still 200 OK
});

// GET /movies/:id -> 200 OK with one movie, or 404 Not Found
app.get("/movies/:id", (req, res) => {
  const movie = findMovie(req.params.id);
  if (!movie) return sendMovieNotFound(res);

  res.json(movie);
});

// POST /movies -> 201 Created with the new movie, or 400 Bad Request
app.post("/movies", requireValidMovie(false), (req, res) => {
  const movie = { id: nextId++, ...movieFields(req.body) };

  movies.push(movie);
  res.status(201).json(movie);
});

// PUT /movies/:id -> 200 OK with the replaced movie, 400 or 404
// Replaces the whole movie: every editable property comes from the request,
// only the id is kept.
app.put("/movies/:id", requireValidMovie(false), (req, res) => {
  const movie = findMovie(req.params.id);
  if (!movie) return sendMovieNotFound(res);

  const replacement = { id: movie.id, ...movieFields(req.body) };
  movies[movies.indexOf(movie)] = replacement;
  res.json(replacement);
});

// PATCH /movies/:id -> 200 OK with the updated movie, 400 or 404
// Changes only the properties that are in the request body.
app.patch("/movies/:id", requireValidMovie(true), (req, res) => {
  const movie = findMovie(req.params.id);
  if (!movie) return sendMovieNotFound(res);

  Object.assign(movie, movieFields(req.body));
  res.json(movie);
});

// DELETE /movies/:id -> 204 No Content (empty body), or 404 Not Found
app.delete("/movies/:id", (req, res) => {
  const movie = findMovie(req.params.id);
  if (!movie) return sendMovieNotFound(res);

  movies = movies.filter((m) => m.id !== movie.id);
  res.status(204).end();
});

/* ---------- Fallback and error handling (must come after the routes) ---------- */

// No route matched -> JSON 404 instead of Express's default HTML page
function unknownRouteHandler(req, res) {
  res
    .status(404)
    .json(errorBody("ROUTE_NOT_FOUND", "The requested route does not exist"));
}

// Error-handling middleware: four arguments, registered last. express.json()
// sends a broken JSON body here; any other error becomes a 500.
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err.type === "entity.parse.failed") {
    return res
      .status(400)
      .json(errorBody("INVALID_JSON", "Request body is not valid JSON"));
  }

  console.error(err);
  res
    .status(500)
    .json(
      errorBody("INTERNAL_SERVER_ERROR", "An unexpected server error occurred"),
    );
}

app.use(unknownRouteHandler);
app.use(errorHandler);

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

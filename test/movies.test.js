// Automated version of the Week 2 test cases (Task 5). Run with: npm test
// The tests share one server and one movies array, so they run in order.
process.env.NODE_ENV = "test";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0); // any free port
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => server.close());

async function request(method, path, body) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await fetch(baseUrl + path, init);
  const text = await res.text();
  return { status: res.status, text, body: text ? JSON.parse(text) : null };
}

const titles = (list) => list.map((movie) => movie.title);
const notFound = {
  error: { code: "MOVIE_NOT_FOUND", message: "Movie not found" },
};

/* ---------- Read ---------- */

test("GET /movies returns an array of all movies", async () => {
  const res = await request("GET", "/movies");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.equal(res.body.length, 5);
});

test("GET /movies/1 returns the correct movie", async () => {
  const res = await request("GET", "/movies/1");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    id: 1,
    title: "Inception",
    year: 2010,
    genre: "Sci-Fi",
  });
});

test("GET /movies/999 returns a consistent 404 error", async () => {
  const res = await request("GET", "/movies/999");
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, notFound);
});

/* ---------- Query parameters ---------- */

test("genre filter is case-insensitive", async () => {
  const res = await request("GET", "/movies?genre=sci-fi");
  assert.equal(res.status, 200);
  assert.deepEqual(titles(res.body), [
    "Inception",
    "The Matrix",
    "Interstellar",
  ]);
});

test("minYear returns movies from that year onwards", async () => {
  const res = await request("GET", "/movies?minYear=2010");
  assert.equal(res.status, 200);
  assert.deepEqual(titles(res.body), ["Inception", "Parasite", "Interstellar"]);
});

test("genre and minYear together apply both filters", async () => {
  const res = await request("GET", "/movies?genre=Sci-Fi&minYear=2000");
  assert.equal(res.status, 200);
  assert.deepEqual(titles(res.body), ["Inception", "Interstellar"]);
});

test("no matching movies returns 200 with an empty array", async () => {
  const res = await request("GET", "/movies?genre=Western");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test("sort=year sorts from oldest to newest", async () => {
  const res = await request("GET", "/movies?sort=year");
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.map((movie) => movie.year),
    [1999, 2001, 2010, 2014, 2019],
  );
});

test("sort=title sorts alphabetically", async () => {
  const res = await request("GET", "/movies?sort=title");
  assert.deepEqual(titles(res.body), [
    "Inception",
    "Interstellar",
    "Parasite",
    "Spirited Away",
    "The Matrix",
  ]);
});

test("filter and sort can be combined", async () => {
  const res = await request(
    "GET",
    "/movies?genre=Sci-Fi&minYear=2000&sort=year",
  );
  assert.deepEqual(titles(res.body), ["Inception", "Interstellar"]);
});

test("sorting does not change the order of the stored array", async () => {
  await request("GET", "/movies?sort=title");
  const res = await request("GET", "/movies");
  assert.deepEqual(
    res.body.map((movie) => movie.id),
    [1, 2, 3, 4, 5],
  );
});

test("invalid minYear returns 400", async () => {
  const res = await request("GET", "/movies?minYear=invalid");
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "INVALID_QUERY");
  assert.deepEqual(res.body.error.details, [
    "minYear must be a whole number, for example ?minYear=2000",
  ]);
});

test("unsupported sort value returns 400", async () => {
  const res = await request("GET", "/movies?sort=rating");
  assert.equal(res.status, 400);
  assert.deepEqual(res.body.error.details, [
    "sort must be one of: year, title",
  ]);
});

/* ---------- Create ---------- */

test("POST /movies creates a movie and the server creates the id", async () => {
  const res = await request("POST", "/movies", {
    id: 100, // ignored: the client does not choose the id
    title: "Arrival",
    year: 2016,
    genre: "Sci-Fi",
  });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body, {
    id: 6,
    title: "Arrival",
    year: 2016,
    genre: "Sci-Fi",
  });

  const list = await request("GET", "/movies");
  assert.ok(titles(list.body).includes("Arrival"));
});

test("POST /movies with invalid data returns validation details", async () => {
  const res = await request("POST", "/movies", {
    title: "",
    year: "not a number",
  });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, {
    error: {
      code: "VALIDATION_ERROR",
      message: "Movie data is invalid",
      details: [
        "title must be a non-empty string",
        `year must be an integer between 1888 and ${new Date().getFullYear() + 5}`,
        "genre is required",
      ],
    },
  });
});

test("POST /movies rejects a year in the far future", async () => {
  const res = await request("POST", "/movies", {
    title: "Future Film",
    year: new Date().getFullYear() + 6,
    genre: "Sci-Fi",
  });
  assert.equal(res.status, 400);
});

test("POST /movies with broken JSON returns 400", async () => {
  const res = await request("POST", "/movies", '{ "title": ');
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "INVALID_JSON");
});

/* ---------- Replace (PUT) ---------- */

test("PUT /movies/1 replaces all editable fields and keeps the id", async () => {
  const res = await request("PUT", "/movies/1", {
    title: "Inception: Updated Edition",
    year: 2010,
    genre: "Thriller",
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    id: 1,
    title: "Inception: Updated Edition",
    year: 2010,
    genre: "Thriller",
  });
  assert.deepEqual((await request("GET", "/movies/1")).body, res.body);
});

test("PUT with a missing property is rejected", async () => {
  const res = await request("PUT", "/movies/1", { title: "Inception" });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body.error.details, [
    "year is required",
    "genre is required",
  ]);
  // nothing changed
  assert.equal((await request("GET", "/movies/1")).body.genre, "Thriller");
});

test("PUT on a missing movie returns 404", async () => {
  const res = await request("PUT", "/movies/999", {
    title: "Ghost",
    year: 1990,
    genre: "Drama",
  });
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, notFound);
});

/* ---------- Update (PATCH) ---------- */

test("PATCH changes only the properties that are sent", async () => {
  const res = await request("PATCH", "/movies/2", { year: 2000 });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    id: 2,
    title: "The Matrix",
    year: 2000,
    genre: "Sci-Fi",
  });
});

test("PATCH with an invalid value returns 400", async () => {
  const res = await request("PATCH", "/movies/2", { genre: "" });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body.error.details, [
    "genre must be a non-empty string",
  ]);
});

test("PATCH with no movie properties returns 400", async () => {
  const res = await request("PATCH", "/movies/2", {});
  assert.equal(res.status, 400);
});

test("PATCH on a missing movie returns 404", async () => {
  const res = await request("PATCH", "/movies/999", { year: 2000 });
  assert.equal(res.status, 404);
});

/* ---------- Delete ---------- */

test("DELETE returns 204 with an empty body", async () => {
  const res = await request("DELETE", "/movies/6");
  assert.equal(res.status, 204);
  assert.equal(res.text, "");
});

test("deleting the same movie again returns 404", async () => {
  const res = await request("DELETE", "/movies/6");
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, notFound);
  assert.equal((await request("GET", "/movies/6")).status, 404);
});

test("a deleted movie's id is not reused", async () => {
  const res = await request("POST", "/movies", {
    title: "Alien",
    year: 1979,
    genre: "Horror",
  });
  assert.equal(res.body.id, 7);
});

/* ---------- Fallback middleware ---------- */

test("unknown routes return a JSON 404", async () => {
  const res = await request("GET", "/does-not-exist");
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, {
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "The requested route does not exist",
    },
  });
});

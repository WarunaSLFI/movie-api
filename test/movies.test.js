// Automated version of the Exercise 3 scenarios. Run with: npm test
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
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

test("GET /movies returns all movies", async () => {
  const res = await request("GET", "/movies");
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 3);
});

test("GET /movies/1 returns one movie", async () => {
  const res = await request("GET", "/movies/1");
  assert.equal(res.status, 200);
  assert.equal(res.body.title, "Inception");
});

test("GET /movies/999 returns 404", async () => {
  const res = await request("GET", "/movies/999");
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: "Movie not found" });
});

test("POST /movies creates a movie with a new id", async () => {
  const res = await request("POST", "/movies", {
    title: "Blade Runner",
    director: "Ridley Scott",
    year: 1982,
  });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body, {
    id: 4,
    title: "Blade Runner",
    director: "Ridley Scott",
    year: 1982,
  });

  const list = await request("GET", "/movies");
  assert.ok(list.body.some((movie) => movie.title === "Blade Runner"));
});

test("POST /movies with missing data returns 400", async () => {
  const res = await request("POST", "/movies", { director: "Nobody" });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, {
    error: "title, director and year are required",
  });
});

test("POST /movies with an invalid year returns 400", async () => {
  const res = await request("POST", "/movies", {
    title: "X",
    director: "Y",
    year: "soon",
  });
  assert.equal(res.status, 400);
});

test("POST /movies with broken JSON returns 400", async () => {
  const res = await request("POST", "/movies", '{ "title": ');
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: "Request body is not valid JSON" });
});

test("PATCH /movies/1 updates only the fields sent", async () => {
  const res = await request("PATCH", "/movies/1", { year: 2011 });
  assert.equal(res.status, 200);
  assert.equal(res.body.year, 2011);
  assert.equal(res.body.title, "Inception");
});

test("DELETE /movies/4 removes the movie and its id is not reused", async () => {
  assert.equal((await request("DELETE", "/movies/4")).status, 204);
  assert.equal((await request("GET", "/movies/4")).status, 404);
  assert.equal((await request("DELETE", "/movies/4")).status, 404);

  const created = await request("POST", "/movies", {
    title: "Alien",
    director: "Ridley Scott",
    year: 1979,
  });
  assert.equal(created.body.id, 5);
});

test("unknown routes return JSON 404", async () => {
  const res = await request("GET", "/films");
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: "Cannot GET /films" });
});

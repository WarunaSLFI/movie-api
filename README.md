# Movie API

A REST API for managing a movie collection, built with **Node.js** and **Express 5** for Backend Development (TAMK).

- **Week 1:** first endpoints (`GET`, `POST`), in-memory data, REST Client and Postman tests.
- **Week 2:** complete CRUD (`PUT`, `PATCH`, `DELETE`), input validation with consistent JSON errors, query parameters for filtering and sorting, Morgan request logging, fallback and error-handling middleware, systematic tests.

The movie data is stored **in memory** (a JavaScript array). A database is added later in the course.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

The API runs at <http://localhost:3000/movies>.

During development, `npm run dev` restarts the server automatically (nodemon) when `app.js` changes.

## Movie data

```json
{ "id": 1, "title": "Inception", "year": 2010, "genre": "Sci-Fi" }
```

The server creates the `id`. The client sends `title`, `year` and `genre`.

## Endpoints

| Method | Path          | What it does                  | Success          | Errors    |
| ------ | ------------- | ----------------------------- | ---------------- | --------- |
| GET    | `/movies`     | List movies (filter and sort) | `200 OK`         | 400       |
| GET    | `/movies/:id` | Get one movie                 | `200 OK`         | 404       |
| POST   | `/movies`     | Create a movie                | `201 Created`    | 400       |
| PUT    | `/movies/:id` | Replace a whole movie         | `200 OK`         | 400 · 404 |
| PATCH  | `/movies/:id` | Change some properties        | `200 OK`         | 400 · 404 |
| DELETE | `/movies/:id` | Delete a movie                | `204 No Content` | 404       |

### PUT and PATCH

- `PUT` replaces the movie. `title`, `year` and `genre` are all required; only the `id` is kept.
- `PATCH` changes only the properties in the request body. Everything else stays the same. At least one of the three properties must be sent.

### Query parameters for `GET /movies`

| Parameter | Example                                | Effect                                            |
| --------- | -------------------------------------- | ------------------------------------------------- |
| `genre`   | `?genre=Sci-Fi`                        | Only movies of this genre (case-insensitive)      |
| `minYear` | `?minYear=2000`                        | Only movies from this year onwards                |
| `sort`    | `?sort=year`                           | `year` = oldest to newest, `title` = alphabetical |
| combined  | `?genre=Sci-Fi&minYear=2000&sort=year` | All filters apply, then the sort                  |

All parameters are optional. No matches gives `200 OK` with `[]`. An invalid `minYear` or an unsupported `sort` value gives `400`. Sorting works on a copy, so the stored array keeps its order.

### Validation rules

| Property | Rule                                                |
| -------- | --------------------------------------------------- |
| `title`  | A non-empty string                                  |
| `year`   | An integer between 1888 and the current year plus 5 |
| `genre`  | A non-empty string                                  |

Properties that are not part of the movie (for example an `id` in the body) are ignored.

### Error responses

Every error has the same JSON shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Movie data is invalid",
    "details": [
      "title is required",
      "year must be an integer between 1888 and 2031"
    ]
  }
}
```

| Code                    | Status | When                               |
| ----------------------- | ------ | ---------------------------------- |
| `VALIDATION_ERROR`      | 400    | Movie data in the body is invalid  |
| `INVALID_QUERY`         | 400    | A query parameter is invalid       |
| `INVALID_JSON`          | 400    | The request body is not valid JSON |
| `MOVIE_NOT_FOUND`       | 404    | No movie with that id              |
| `ROUTE_NOT_FOUND`       | 404    | No such route                      |
| `INTERNAL_SERVER_ERROR` | 500    | Unexpected error on the server     |

## Middleware

```
Client → morgan → express.json() → route (→ requireValidMovie) → handler → response
                                      ↓ no route matched
                                  unknownRouteHandler (404)
                    any error → errorHandler (400 for broken JSON, otherwise 500)
```

- **Morgan** (`dev` format) logs every request, for example `GET /movies 200 1.029 ms - 120`. It is registered before `express.json()` so it also logs requests whose JSON body is broken.
- **simpleLogger** is the hand-written logger from Task 4.2. It is off by default; `node app.js --simple-logger` switches it on next to Morgan for comparison.
- **requireValidMovie** runs the validation on `POST`, `PUT` and `PATCH` before the route handler.
- **unknownRouteHandler** and **errorHandler** come after all routes.

## Testing

- **REST Client** (VS Code): open `requests.http` and click _Send Request_ above any request. Send "Create a valid movie" before the two DELETE requests. The file can be repeated without restarting the server.
- **Postman**: import `postman/movie-api.postman_collection.json` and run it with the Collection Runner. Every request has tests for the status code and the response body.
- **Automated tests**: `npm test` runs 28 tests with Node's built-in test runner.

## Scripts

| Script                 | What it does                            |
| ---------------------- | --------------------------------------- |
| `npm start`            | Start the server on port 3000           |
| `npm run dev`          | Start with nodemon (auto restart)       |
| `npm test`             | Run the automated API tests             |
| `npm run lint`         | Check the code with ESLint              |
| `npm run format`       | Format the code with Prettier           |
| `npm run format:check` | Check formatting without changing files |

## Project structure

```
movie-api/
├── app.js               Express app: data, validation, middleware, routes, error handling
├── requests.http        REST Client requests
├── postman/             Postman collection
├── test/                Automated tests (node:test)
├── eslint.config.js     ESLint rules
└── .prettierrc.json     Prettier settings
```

## Why the data disappears

`let movies = [...]` lives in the memory of the running Node.js process. When the process stops, the operating system frees that memory. The next `node app.js` starts from the hard-coded movies again, so everything added, changed or deleted is lost.

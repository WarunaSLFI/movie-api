# Movie API

A REST API for managing a movie collection, built with **Node.js** and **Express 5** for Backend Development, Week 1 (TAMK).

The movie data is stored **in memory** (a JavaScript array), as the Week 1 exercise requires. A database is added later in the course.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

The API runs at <http://localhost:3000/movies>.

During development, `npm run dev` restarts the server automatically (nodemon) when `app.js` changes.

## Endpoints

| Method | Path          | Success          | Errors    |
| ------ | ------------- | ---------------- | --------- |
| GET    | `/movies`     | `200 OK`         | –         |
| GET    | `/movies/:id` | `200 OK`         | 404       |
| POST   | `/movies`     | `201 Created`    | 400       |
| PATCH  | `/movies/:id` | `200 OK`         | 400 · 404 |
| DELETE | `/movies/:id` | `204 No Content` | 404       |

`PATCH` and `DELETE` are the Week 1 bonus tasks.

Error responses are JSON, for example:

```json
{ "error": "Movie not found" }
```

```json
{ "error": "title, director and year are required" }
```

### Validation

- `POST` needs `title`, `director` and `year`.
- `PATCH` accepts any of the three fields, but at least one.
- `title` and `director` must be non-empty strings.
- `year` must be a whole number between 1888 and the current year + 10.
- A body that is not valid JSON is rejected with `400`.
- Unknown routes return a JSON `404`.

## Testing

- **REST Client** (VS Code): open `requests.http` and click _Send Request_ above any request.
- **Postman**: import `postman/movie-api.postman_collection.json`. Every request has a test that checks its status code.
- **Automated tests**: `npm test` runs the same scenarios with Node's built-in test runner.

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
├── app.js               Express app: data, middleware, routes, error handling
├── requests.http        REST Client requests
├── postman/             Postman collection
├── test/                Automated tests (node:test)
├── eslint.config.js     ESLint rules
└── .prettierrc.json     Prettier settings
```

## How a request flows

```
Client → logger → express.json() → router → validateMovie() → route handler → response
```

The logger runs before `express.json()` so it also records requests whose body is not valid JSON. `validateMovie()` is used only on `POST /movies` and `PATCH /movies/:id`.

## Why the data disappears

`let movies = [...]` lives in the memory of the running Node.js process. When the process stops, the operating system frees that memory. The next `node app.js` starts from the three hard-coded movies again, so everything added, changed or deleted is lost.

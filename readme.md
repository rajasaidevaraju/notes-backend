# Notes API

A simple RESTful API built with Express.js, TypeScript, and SQLite to manage notes, including a special pinned "Clipboard" note.

## Overview

This application provides a backend API for creating, reading, updating, and deleting notes stored in a SQLite database. It includes a special "Clipboard" note that is automatically created, pinned, and protected from certain modifications (e.g., title changes or deletion).

## Features

- **CRUD Operations**: Create, read, update, and delete notes.
- **Special Clipboard Note**: A reserved note titled "Clipboard" that is pinned and cannot be deleted or have its title changed.
- **Environment Configuration**: Uses `dotenv` to load environment variables (e.g., `PORT` and `DATABASE_PATH`).
- **Type Safety**: Built with TypeScript for type-safe code.
- **SQLite Database**: Persistent storage using `better-sqlite3`.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- SQLite (included via `better-sqlite3`)

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory with the following:
   ```env
   PORT=3000
   DATABASE_PATH=./database/notes.db
   ```

4. **Run the application**:
   ```bash
   npm start
   ```

   The server will start on `http://localhost:3000` (or the port specified in `.env`).

## API Endpoints

### `GET /`
- **Description**: Returns a welcome message.
- **Response**: `200 OK` with a text message: "Hello from Express with TypeScript and SQLite!"

### `GET /notes`
- **Description**: Retrieves all notes from the database.
- **Response**:
  - `200 OK`: JSON array of notes with `id`, `title`, `content`, `createdAt`, `updatedAt`, and `pinned` fields.
  - `500 Internal Server Error`: If there's an error fetching notes.

### `POST /notes`
- **Description**: Creates a new note.
- **Request Body**:
  ```json
  {
    "title": "string",
    "content": "string",
    "pinned": boolean (optional, defaults to false)
  }
  ```
- **Constraints**:
  - `title` is required.
  - `title` cannot be "Clipboard" (reserved).
- **Response**:
  - `201 Created`: JSON object of the created note.
  - `400 Bad Request`: If `title` is missing or is "Clipboard".
  - `500 Internal Server Error`: If there's an error creating the note.

### `PUT /notes/:id`
- **Description**: Updates an existing note by ID.
- **Request Body**:
  ```json
  {
    "title": "string",
    "content": "string",
    "pinned": boolean (optional)
  }
  ```
- **Constraints**:
  - `title` is required.
  - For the "Clipboard" note:
    - Title must remain "Clipboard".
    - Note must remain pinned.
  - For other notes, `title` cannot be changed to "Clipboard".
- **Response**:
  - `200 OK`: JSON object of the updated note.
  - `400 Bad Request`: If `title` is missing.
  - `403 Forbidden`: If attempting to modify the "Clipboard" note's title or pinned status, or change a note's title to "Clipboard".
  - `404 Not Found`: If the note ID doesn't exist.
  - `500 Internal Server Error`: If there's an error updating the note.

### `DELETE /notes/:id`
- **Description**: Deletes a note by ID.
- **Constraints**:
  - The "Clipboard" note cannot be deleted.
- **Response**:
  - `204 No Content`: On successful deletion.
  - `403 Forbidden`: If attempting to delete the "Clipboard" note.
  - `404 Not Found`: If the note ID doesn't exist.
  - `500 Internal Server Error`: If there's an error deleting the note.

## Database Schema

The application uses a SQLite database with a single `notes` table:

| Column      | Type    | Description                              |
|-------------|---------|------------------------------------------|
| `id`        | INTEGER | Primary key, auto-incremented.           |
| `title`     | TEXT    | Note title (required).                   |
| `content`   | TEXT    | Note content (optional).                 |
| `createdAt` | TEXT    | Creation timestamp (default: current).   |
| `updatedAt` | TEXT    | Update timestamp (default: current).     |
| `pinned`    | INTEGER | Pinned status (0 = false, 1 = true).     |

A special "Clipboard" note is created on server startup if it doesn't exist, with `pinned = 1`.

## Notes

- The database file path is specified in the `DATABASE_PATH` environment variable.
- The database directory is automatically created if it doesn't exist.
- The server gracefully closes the SQLite connection on `SIGINT` (e.g., Ctrl+C).
- The `pinned` column is added to existing databases via a migration check during initialization.

## Dependencies

- `express`: Web framework for Node.js.
- `better-sqlite3`: SQLite database driver.
- `dotenv`: Environment variable management.
- `typescript`: Type-safe JavaScript superset.

## Running the Application

Run the application using:
```bash
npm start
```

The server will log the port and database path on startup, and indicate whether the "Clipboard" note was created or already exists.

## Example Usage

**Create a note**:
```bash
curl -X POST http://localhost:3000/notes \
-H "Content-Type: application/json" \
-d '{"title":"My Note","content":"Hello, world!","pinned":true}'
```

**Get all notes**:
```bash
curl http://localhost:3000/notes
```

**Update the Clipboard note**:
```bash
curl -X PUT http://localhost:3000/notes/1 \
-H "Content-Type: application/json" \
-d '{"title":"Clipboard","content":"New clipboard content"}'
```

**Delete a note**:
```bash
curl -X DELETE http://localhost:3000/notes/2
```

## Using a Dummy Database for Testing

To avoid affecting your original data, you can create a dummy SQLite database (`test.db`) for testing new features.

Run the following command:

```bash
npm run testdb
```
This will create (or overwrite) a test.db file with sample data.

Next, in your .env file, update DATABASE_PATH to point to the dummy database:
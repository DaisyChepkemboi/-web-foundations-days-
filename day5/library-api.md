
# Library Books REST API

## Overview

This API manages a library's book collection. It follows REST conventions by using HTTP methods to describe actions and resource URLs to identify books.

Base path: `/api/books`

## Endpoints

### 1. List all books

- **Method:** `GET`
- **Path:** `/api/books`
- **Description:** Returns a list of all books in the library.
- **Example request body:** None.
- **Success status:** `200 OK`

### 2. Get one book

- **Method:** `GET`
- **Path:** `/api/books/{bookId}`
- **Description:** Returns the details of a specific book using its ID.
- **Example request body:** None.
- **Success status:** `200 OK`

### 3. Create a book

- **Method:** `POST`
- **Path:** `/api/books`
- **Description:** Creates a new book in the library.
- **Example request body:**

  ```json
  {
    "title": "Things Fall Apart",
    "author": "Chinua Achebe",
    "publishedYear": 1958
  }
  ```

- **Success status:** `201 Created`

### 4. Update a book

- **Method:** `PUT`
- **Path:** `/api/books/{bookId}`
- **Description:** Replaces the details of an existing book.
- **Example request body:**

  ```json
  {
    "title": "Things Fall Apart",
    "author": "Chinua Achebe",
    "publishedYear": 1958
  }
  ```

- **Success status:** `200 OK`

### 5. Delete a book

- **Method:** `DELETE`
- **Path:** `/api/books/{bookId}`
- **Description:** Deletes the specified book from the library.
- **Example request body:** None.
- **Success status:** `204 No Content`

### 6. List books by author

- **Method:** `GET`
- **Path:** `/api/books?author=Chinua%20Achebe`
- **Description:** Returns books written by the author specified in the `author` query parameter.
- **Example request body:** None.
- **Success status:** `200 OK`

## Error Responses

### 400 Bad Request

The request is invalid or contains missing or incorrectly formatted data.

**Example:** Creating a book without a required title or author.

Example response:

```json
{
  "error": "Title and author are required."
}
```

### 404 Not Found

The requested resource does not exist.

**Example:** Requesting `GET /api/books/9999` when no book with ID `9999` exists.

Example response:

```json
{
  "error": "Book not found."
}
```

## HTTP Status Code Summary

- `200 OK` — The request succeeded.
- `201 Created` — A new book was created.
- `204 No Content` — A book was deleted successfully.
- `400 Bad Request` — The request contains invalid data.
- `404 Not Found` — The requested book or resource does not exist.

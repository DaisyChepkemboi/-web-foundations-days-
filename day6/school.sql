
--  Day 6 Assignment: School Database
-- SQLite

PRAGMA foreign_keys = ON;

-- 1. Create the students table
CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

-- 2. Create the courses table
CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT
);

-- 3. Create the enrolments table
-- This join table connects students and courses.
CREATE TABLE enrolments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,

    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),

    -- A student cannot enrol on the same course twice.
    UNIQUE (student_id, course_id)
);

-- 4. Insert sample students
INSERT INTO students (name, email) VALUES
    ('Alice Wanjiku', 'alice@example.com'),
    ('Brian Otieno', 'brian@example.com'),
    ('Carol Chebet', 'carol@example.com'),
    ('David Kiptoo', 'david@example.com');

-- 5. Insert sample courses
INSERT INTO courses (title, description) VALUES
    ('Database Systems', 'Learn relational databases and SQL'),
    ('Web Development', 'Learn how to build websites'),
    ('Python Programming', 'Learn programming with Python');

-- 6. Insert sample enrolments
INSERT INTO enrolments (student_id, course_id, grade) VALUES
    (1, 1, 'A'),
    (1, 2, 'B'),
    (2, 1, 'B'),
    (2, 3, 'A'),
    (3, 2, 'A');

-- David (student 4) has no enrolments.

-- QUERY 1: All courses for one student, by student name
SELECT
    s.name AS student_name,
    c.title AS course_title,
    e.grade
FROM students AS s
JOIN enrolments AS e ON s.id = e.student_id
JOIN courses AS c ON c.id = e.course_id
WHERE s.name = 'Alice Wanjiku';

-- QUERY 2: All students enrolled on one course
SELECT
    c.title AS course_title,
    s.name AS student_name,
    e.grade
FROM courses AS c
JOIN enrolments AS e ON c.id = e.course_id
JOIN students AS s ON s.id = e.student_id
WHERE c.title = 'Database Systems';

-- QUERY 3: Number of students enrolled in each course
-- LEFT JOIN includes courses with zero enrolments.
SELECT
    c.title AS course_title,
    COUNT(e.student_id) AS student_count
FROM courses AS c
LEFT JOIN enrolments AS e ON c.id = e.course_id
GROUP BY c.id, c.title
ORDER BY c.title;

-- QUERY 4: Students who have no enrolments
SELECT
    s.id,
    s.name,
    s.email
FROM students AS s
LEFT JOIN enrolments AS e ON s.id = e.student_id
WHERE e.id IS NULL;

-- QUERY 5: Update one enrolment's grade
UPDATE enrolments
SET grade = 'A'
WHERE student_id = 2
  AND course_id = 1;

-- Optional: Verify the grade update
SELECT
    s.name AS student_name,
    c.title AS course_title,
    e.grade
FROM enrolments AS e
JOIN students AS s ON s.id = e.student_id
JOIN courses AS c ON c.id = e.course_id
WHERE e.student_id = 2
  AND e.course_id = 1;

-- Optional index for looking up a student's enrolments
CREATE INDEX idx_enrolments_student_id
ON enrolments(student_id);

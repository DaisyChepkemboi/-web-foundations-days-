
# School Database Design

## Tables

### 1. Students
The `students` table stores each student's ID, name, and email address. The ID is the primary key, and the email is unique and required so that two students cannot register with the same email address.

### 2. Courses
The `courses` table stores each course's ID, title, and optional description. The ID is the primary key, and the title is required.

### 3. Enrolments
The `enrolments` table records which student is enrolled on which course, together with their grade. Its ID is the primary key. The `student_id` and `course_id` columns are foreign keys referencing the students and courses tables. Both foreign keys are required. A UNIQUE constraint on `(student_id, course_id)` prevents a student from enrolling on the same course more than once.

## Relationships

Students and enrolments have a one-to-many relationship because one student can have several enrolment records, while each enrolment belongs to one student.

Courses and enrolments also have a one-to-many relationship because one course can have several enrolment records, while each enrolment belongs to one course.

Students and courses therefore have a many-to-many relationship: a student can take multiple courses, and a course can have multiple students. The `enrolments` table is needed as a join table to represent this relationship. It also stores information specific to an enrolment, such as the student's grade.

## Index

I would add an index on `enrolments.student_id` to speed up searches for the courses a particular student has taken. This is useful when the database contains many students and enrolments.

## SQL or NoSQL?

I would choose a relational SQL database such as SQLite for this school system. The data has clear relationships between students, courses, and enrolments, and foreign keys help maintain referential integrity. SQL supports JOINs, grouping, counting, and updating grades efficiently. Constraints such as UNIQUE and NOT NULL also help prevent invalid data. A NoSQL database could be useful for more flexible or document-oriented data, but a relational database is a natural fit for this structured system.

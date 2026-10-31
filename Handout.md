# Advanced DBMS Study Handout

Oct 31, 2026 · @Asim Riaz

This handout covers the two halves of the course so far: procedural programming inside PostgreSQL with PL/pgSQL, and document databases with MongoDB. Each topic has an explanation, runnable examples and practice at the end.

## What this handout covers

| Area | Topics |
| --- | --- |
| PL/pgSQL fundamentals | Block structure, anonymous DO blocks, variables and types, SELECT INTO, RAISE, IF/ELSIF/CASE, all four loop forms, exception handling |
| Functions, procedures and cursors | Writing and calling functions and procedures, how they differ, implicit and explicit cursors, the cursor lifecycle, FETCH INTO, scrollable cursors |
| Triggers | Trigger functions, BEFORE and AFTER, row and statement level, OLD and NEW, TG\_OP, audit triggers |
| NoSQL and MongoDB basics | NoSQL families, SQL and MongoDB terminology, BSON and \_id, rigid vs flexible schema, embedding vs referencing, CRUD, find with filters, projection and sort |
| Aggregation and Mongoose | Pipeline stages, $match, $group, $project, $lookup, $unwind, indexes, Mongoose schemas with ref and populate() |

## How to study with this handout

1. Read each section and run every example yourself in psql or mongosh. All PL/pgSQL examples were run on PostgreSQL 16 and work unchanged on 18.
2. After each section, close the handout and rewrite the examples from memory, then change them (a different range, a different table, a different collection).
3. Answer the practice questions at the end before checking the model answers.

## PL/pgSQL fundamentals

PL/pgSQL is PostgreSQL's procedural language: it adds variables, conditions, loops and error handling to plain SQL, and runs inside the database server.

### Block structure

Every PL/pgSQL program is a block with an optional DECLARE part, a mandatory BEGIN … END body, and an optional EXCEPTION part.

```sql
[ <<label>> ]
[ DECLARE
    declarations; ]
BEGIN
    statements;
[ EXCEPTION
    WHEN condition THEN handler_statements; ]
END;
```

- The code body is written as a string. `$$ … $$` (dollar quoting) avoids escaping single quotes inside the code.
- `BEGIN` here only groups statements. It does not start a transaction.
- Every statement ends with a semicolon, including `END IF;` and `END LOOP;`.

### Anonymous DO block

`DO` executes a block once without saving anything in the database. It takes no parameters and returns nothing, so output is shown with `RAISE NOTICE`.

```sql
DO $$
DECLARE
    v_name    VARCHAR(50) := 'Ali';
    v_marks   INTEGER     := 78;
BEGIN
    RAISE NOTICE 'Student % scored %', v_name, v_marks;
END;
$$ LANGUAGE plpgsql;
```

Output: `NOTICE: Student Ali scored 78`. Each `%` in the message is replaced by the next argument in order.

### Variables and data types

| Declaration | Meaning |
| --- | --- |
| `v_count INTEGER := 0;` | Variable with an initial value (`:=` or `=` assigns) |
| `v_rate CONSTANT NUMERIC := 0.17;` | Value cannot change after declaration |
| `v_sal employees.salary%TYPE;` | Same type as a table column; follows the column if its type changes |
| `v_emp employees%ROWTYPE;` | Holds a whole row of the table; read fields as `v_emp.name` |
| `v_rec RECORD;` | Holds any row; its shape is set by the query that fills it |
| `v_id INTEGER NOT NULL := 1;` | Must always hold a value |

A variable declared without a value starts as NULL.

### Reading data into variables: SELECT … INTO

```sql
DO $$
DECLARE
    v_name employees.name%TYPE;
    v_sal  employees.salary%TYPE;
BEGIN
    SELECT name, salary INTO v_name, v_sal
    FROM employees WHERE emp_id = 2;

    IF NOT FOUND THEN
        RAISE NOTICE 'No such employee';
    ELSE
        RAISE NOTICE '% earns %', v_name, v_sal;
    END IF;
END $$;
```

`FOUND` is a built-in boolean. It is true when the last `SELECT INTO`, `FETCH`, `UPDATE`, `INSERT` or `DELETE` touched at least one row. `SELECT INTO` keeps only the first row if the query returns several (`SELECT … INTO STRICT` raises an error instead).

### RAISE: messages and errors

| Level | Effect |
| --- | --- |
| `RAISE NOTICE` | Prints a message and continues (used for printing output in DO blocks) |
| `RAISE INFO`, `WARNING`, `LOG`, `DEBUG` | Other message levels; execution continues |
| `RAISE EXCEPTION` | Raises an error, stops the block and rolls back its work |

### Conditions: IF, ELSIF, CASE

```sql
IF v_sal >= 70000 THEN
    RAISE NOTICE 'High';
ELSIF v_sal >= 50000 THEN
    RAISE NOTICE 'Medium';
ELSE
    RAISE NOTICE 'Low';
END IF;
```

The extra branch keyword is **ELSIF** (also accepted as ELSEIF, but ELSIF is the standard form). `ELSE IF` would open a new nested IF that needs its own `END IF`.

```sql
CASE
    WHEN v_marks >= 85 THEN v_grade := 'A';
    WHEN v_marks >= 70 THEN v_grade := 'B';
    ELSE v_grade := 'C';
END CASE;
```

### Loops

PL/pgSQL has four loop forms. You must be able to write the even and odd number programs with each one.

| Loop | Stops when | Typical use |
| --- | --- | --- |
| `LOOP … END LOOP` | An `EXIT` or `EXIT WHEN` runs | Unknown number of passes, cursor reading |
| `WHILE cond LOOP` | The condition becomes false (checked before each pass) | Counter you update yourself |
| `FOR i IN a..b [BY n] LOOP` | The counter passes b | Fixed number range |
| `FOR rec IN query LOOP` | The query has no more rows | Processing each row of a result |

Key rules:

- The integer FOR loop declares its counter automatically as INTEGER; it is local to the loop and you must not declare it.
- `BY n` sets the step (default 1).
- `FOR i IN REVERSE 10..1` counts down 10, 9, …, 1. With REVERSE the upper bound is written first.
- `FOR i IN 10..1` (no REVERSE) runs zero times, and putting REVERSE after the range is a syntax error.
- `EXIT WHEN cond;` leaves the loop. `CONTINUE WHEN cond;` skips to the next pass.

### Loop examples

FOR loop with a step: multiples of 5 up to 50.

```sql
DO $$
BEGIN
    FOR i IN 5..50 BY 5 LOOP
        RAISE NOTICE '%', i;
    END LOOP;
END $$;
-- 5, 10, 15, ..., 50
```

FOR loop with a remainder test: the `%` operator gives the remainder, so `i % 3 = 0` means "divisible by 3".

```sql
DO $$
BEGIN
    FOR i IN 1..20 LOOP
        IF i % 3 = 0 THEN
            RAISE NOTICE '% is a multiple of 3', i;
        END IF;
    END LOOP;
END $$;
-- 3, 6, 9, 12, 15, 18
```

REVERSE with a step: counting down in threes.

```sql
DO $$
BEGIN
    FOR i IN REVERSE 30..3 BY 3 LOOP
        RAISE NOTICE '%', i;
    END LOOP;
END $$;
-- 30, 27, 24, ..., 3
```

WHILE loop: the sum of 1 to 10. You declare and update the counter yourself.

```sql
DO $$
DECLARE
    i     INTEGER := 1;
    total INTEGER := 0;
BEGIN
    WHILE i <= 10 LOOP
        total := total + i;
        i := i + 1;
    END LOOP;
    RAISE NOTICE 'Sum = %', total;
END $$;
-- Sum = 55
```

Basic LOOP with EXIT: factorial of 5.

```sql
DO $$
DECLARE
    n    INTEGER := 5;
    fact BIGINT  := 1;
BEGIN
    LOOP
        EXIT WHEN n = 0;
        fact := fact * n;
        n := n - 1;
    END LOOP;
    RAISE NOTICE 'Factorial = %', fact;
END $$;
-- Factorial = 120
```

Basic LOOP with CONTINUE: skip every number that is not a multiple of 5.

```sql
DO $$
DECLARE
    i INTEGER := 0;
BEGIN
    LOOP
        i := i + 1;
        EXIT WHEN i > 15;
        CONTINUE WHEN i % 5 <> 0;
        RAISE NOTICE '%', i;
    END LOOP;
END $$;
-- 5, 10, 15
```

In a WHILE or basic loop, forgetting to change the counter creates an infinite loop, which is the most common mistake.

### Query FOR loop

```sql
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT name, salary FROM employees WHERE dept = 'IT' LOOP
        RAISE NOTICE '% earns %', r.name, r.salary;
    END LOOP;
END $$;
```

This is an implicit cursor: PostgreSQL opens, fetches and closes it for you.

### Exception handling

```sql
DO $$
DECLARE
    v_result NUMERIC;
BEGIN
    v_result := 100 / 0;
EXCEPTION
    WHEN division_by_zero THEN
        RAISE NOTICE 'Cannot divide by zero';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %', SQLERRM;
END $$;
```

Common condition names: `division_by_zero`, `unique_violation`, `foreign_key_violation`, `no_data_found` and `too_many_rows` (with STRICT), and `OTHERS` for anything. `SQLERRM` holds the error message and `SQLSTATE` its code. When an exception is caught, changes made inside that block are rolled back.

## Functions, procedures and cursors

A function returns a value and is called inside a query; a procedure returns nothing, is run with CALL, and may commit transactions. A cursor reads a query's result one row at a time.

### Practice table used in all examples

```sql
CREATE TABLE employees (
    emp_id  INT PRIMARY KEY,
    name    TEXT,
    salary  NUMERIC,
    dept    TEXT
);

INSERT INTO employees VALUES
 (1,'Ali',50000,'IT'),    (2,'Sara',65000,'HR'),
 (3,'Bilal',42000,'IT'),  (4,'Hina',80000,'Finance'),
 (5,'Omar',55000,'IT'),   (6,'Zara',61000,'HR'),
 (7,'Usman',47000,'Finance');
```

### Functions

```sql
CREATE OR REPLACE FUNCTION get_salary(p_id INT)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
    v_sal NUMERIC;
BEGIN
    SELECT salary INTO v_sal FROM employees WHERE emp_id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % not found', p_id;
    END IF;
    RETURN v_sal;
END;
$$;

SELECT get_salary(3);          -- 42000
```

A function can also return a set of rows with `RETURNS TABLE` (or `SETOF`) and `RETURN QUERY`:

```sql
CREATE OR REPLACE FUNCTION dept_staff(p_dept TEXT)
RETURNS TABLE(emp_id INT, name TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
        SELECT e.emp_id, e.name FROM employees e WHERE e.dept = p_dept;
END;
$$;

SELECT * FROM dept_staff('IT');   -- Ali, Bilal, Omar
```

The table alias `e` avoids a clash between the output column names and the table's column names.

### Procedures

```sql
CREATE OR REPLACE PROCEDURE give_raise(p_dept TEXT, p_pct NUMERIC)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE employees
    SET salary = ROUND(salary * (1 + p_pct / 100), 2)
    WHERE dept = p_dept;
    COMMIT;                    -- allowed in a procedure, not in a function
END;
$$;

CALL give_raise('HR', 10);
```

A procedure hands values back through `INOUT` (or, from PostgreSQL 14, `OUT`) parameters:

```sql
CREATE OR REPLACE PROCEDURE count_dept(IN p_dept TEXT, INOUT p_total INT DEFAULT NULL)
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT COUNT(*) INTO p_total FROM employees WHERE dept = p_dept;
END;
$$;

CALL count_dept('IT');          -- p_total = 3
```

### Function vs procedure

| Point | FUNCTION | PROCEDURE |
| --- | --- | --- |
| Return value | Must have a `RETURNS` clause (a value, a row, a set, or `void`) | No `RETURNS` clause; values come back through `INOUT`/`OUT` parameters |
| How it is called | Inside SQL: `SELECT f(x);`, in `WHERE`, in another query | Only as a statement: `CALL p(x);` |
| Transaction control | Cannot `COMMIT` or `ROLLBACK`; runs inside the caller's transaction | Can `COMMIT` and `ROLLBACK` inside its body (when not called inside an outer transaction block) |
| Use in queries | Can be used in SELECT lists, WHERE, triggers (trigger functions) | Cannot be used in an expression or a query |
| Typical use | Calculations, lookups, returning data, trigger logic | Batch jobs and multi-step changes that commit in stages |
| Introduced | Long-standing | PostgreSQL 11 |

### Cursors

A cursor is a named pointer into a query's result, so a program can process rows one at a time instead of loading them all at once.

### Implicit vs explicit cursors

|  | Implicit cursor | Explicit cursor |
| --- | --- | --- |
| Who manages it | PostgreSQL, automatically | The programmer |
| Declared in DECLARE? | No | Yes: `cur CURSOR FOR SELECT …;` |
| Lifecycle steps | None written: open, fetch and close happen for you | You write DECLARE → OPEN → FETCH → CLOSE |
| Where it appears | `SELECT … INTO`, `FOR rec IN SELECT … LOOP`, single `UPDATE`/`DELETE` statements | Any time you need control over position or pace |
| Control over position | None, rows come in order | Full: FETCH NEXT, PRIOR, LAST, ABSOLUTE n with SCROLL |
| Status check | `FOUND` after the statement | `FOUND` after each `FETCH` |

### Explicit cursor lifecycle

The order is **DECLARE → OPEN → FETCH → CLOSE**.

1. **DECLARE** names the cursor and binds it to a query.
2. **OPEN** runs the query and places the pointer before the first row.
3. **FETCH** moves the pointer and copies the row into variables. Repeat until `NOT FOUND`.
4. **CLOSE** releases the cursor's resources.

```sql
DO $$
DECLARE
    cur_emp CURSOR FOR SELECT name, salary FROM employees ORDER BY name;
    rec RECORD;
BEGIN
    OPEN cur_emp;
    LOOP
        FETCH cur_emp INTO rec;
        EXIT WHEN NOT FOUND;
        RAISE NOTICE '% earns %', rec.name, rec.salary;
    END LOOP;
    CLOSE cur_emp;
END $$;
```

A cursor can take parameters: `cur CURSOR (p_dept TEXT) FOR SELECT … WHERE dept = p_dept;` then `OPEN cur('IT');`. An unbound cursor is declared as `c REFCURSOR;` and opened with `OPEN c FOR SELECT …;`.

### SELECT … INTO vs FETCH … INTO

|  | SELECT … INTO | FETCH … INTO |
| --- | --- | --- |
| Source | Runs a query directly | Reads from an already-open cursor |
| Rows handled | One row (the first; STRICT demands exactly one) | One row per call; call repeatedly to walk the result |
| Cursor needed? | No (implicit cursor) | Yes, explicit cursor declared and opened |
| Position | Always the first row | Next, prior, first, last or any position (with SCROLL) |
| End check | `IF NOT FOUND` after it | `EXIT WHEN NOT FOUND` inside a loop |
| Example | `SELECT name INTO v_name FROM employees WHERE emp_id = 1;` | `FETCH cur_emp INTO v_name;` |

### Scrollable cursors

A normal cursor is only guaranteed to move forward. Add the **SCROLL** keyword to move backward or jump to a position.

```sql
cur SCROLL CURSOR FOR SELECT emp_id, name FROM employees ORDER BY emp_id;
```

| FETCH direction | Row it returns (7 rows, ordered by emp\_id) |
| --- | --- |
| `FETCH NEXT` (default) | The row after the current one |
| `FETCH PRIOR` | The row before the current one (needs SCROLL) |
| `FETCH FIRST` | Row 1 |
| `FETCH LAST` | Row 7 |
| `FETCH ABSOLUTE n` | Row n counted from the start |
| `FETCH ABSOLUTE -n` | Row n counted from the end (-1 is the last row) |
| `FETCH RELATIVE n` | n rows forward from the current position (negative n moves back) |

Always use `ORDER BY` in the cursor query; without it "last" and "6th" have no fixed meaning.

### Example: moving around a scrollable cursor

```sql
DO $$
DECLARE
    cur_emp SCROLL CURSOR FOR
        SELECT emp_id, name FROM employees ORDER BY emp_id;
    rec RECORD;
BEGIN
    OPEN cur_emp;

    FETCH FIRST       FROM cur_emp INTO rec;  RAISE NOTICE 'FIRST: %', rec.name;        -- Ali
    FETCH ABSOLUTE 4  FROM cur_emp INTO rec;  RAISE NOTICE 'ABSOLUTE 4: %', rec.name;   -- Hina
    FETCH RELATIVE 2  FROM cur_emp INTO rec;  RAISE NOTICE 'RELATIVE 2: %', rec.name;   -- Zara
    FETCH PRIOR       FROM cur_emp INTO rec;  RAISE NOTICE 'PRIOR: %', rec.name;        -- Omar
    FETCH LAST        FROM cur_emp INTO rec;  RAISE NOTICE 'LAST: %', rec.name;         -- Usman
    FETCH ABSOLUTE -3 FROM cur_emp INTO rec;  RAISE NOTICE 'ABSOLUTE -3: %', rec.name;  -- Omar

    CLOSE cur_emp;
END $$;
```

Trace it yourself: after `ABSOLUTE 4` the pointer is on row 4, so `RELATIVE 2` lands on row 6 and `PRIOR` steps back to row 5. All results were checked against the practice table on PostgreSQL 16.

The cursor's ORDER BY decides what "first" and "last" mean. Ordering by `salary DESC` instead turns `FETCH ABSOLUTE 2` into "the second-highest earner".

## Triggers

A trigger makes PostgreSQL run a trigger function automatically when an INSERT, UPDATE, DELETE or TRUNCATE happens on a table. You need two objects: the trigger function and the trigger that attaches it.

### Step 1: trigger function

```sql
CREATE OR REPLACE FUNCTION trg_validate_emp()
RETURNS TRIGGER                 -- special return type, no parameters
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.salary < 0 THEN
        RAISE EXCEPTION 'Salary cannot be negative';
    END IF;
    NEW.name := INITCAP(NEW.name);  -- fix the data before it is saved
    RETURN NEW;                     -- the row that will be written
END;
$$;
```

### Step 2: the trigger

```sql
CREATE TRIGGER before_emp_change
BEFORE INSERT OR UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION trg_validate_emp();
```

- **Timing:** `BEFORE`, `AFTER`, or `INSTEAD OF` (views only).
- **Events:** any mix of `INSERT`, `UPDATE [OF column]`, `DELETE`, `TRUNCATE`.
- **Level:** `FOR EACH ROW` fires once per affected row; `FOR EACH STATEMENT` (default) fires once per statement, however many rows change.
- Optional `WHEN (condition)` limits when it fires, for example `WHEN (OLD.salary IS DISTINCT FROM NEW.salary)`.
- Remove with `DROP TRIGGER before_emp_change ON employees;`.

### OLD and NEW

`NEW` and `OLD` are record variables PostgreSQL fills automatically in a row-level trigger.

| Variable | Holds | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `NEW` | The row as it will be (or was) written | The new row | The row after the change | NULL |
| `OLD` | The row as it was before the operation | NULL | The row before the change | The row being deleted |

- In a BEFORE trigger you may change `NEW` (for example `NEW.name := UPPER(NEW.name)`) and the changed row is what gets saved.
- `OLD` is read-only in practice; you use it to compare or audit.
- In statement-level triggers both are NULL.

Other useful trigger variables: `TG_OP` (the operation as text: 'INSERT', 'UPDATE', 'DELETE'), `TG_TABLE_NAME`, `TG_WHEN` ('BEFORE' or 'AFTER') and `TG_LEVEL` ('ROW' or 'STATEMENT').

### BEFORE vs AFTER row-level triggers

|  | BEFORE row trigger | AFTER row trigger |
| --- | --- | --- |
| When it runs | Before the row is written to the table | After the row is written and constraints are checked |
| Can change the row? | Yes: modify `NEW` and return it | No: the row is already saved; the return value is ignored |
| Can cancel the row? | Yes: `RETURN NULL` silently skips that row; `RAISE EXCEPTION` aborts the statement | Only by `RAISE EXCEPTION`, which rolls back the whole statement |
| What to return | `NEW` for INSERT and UPDATE, `OLD` for DELETE | Usually `NULL` (ignored) |
| Sees final values? | Not yet: defaults and later BEFORE triggers may still change things | Yes, including generated keys |
| Typical uses | Validation, cleaning data, computing columns, setting `updated_at` | Audit logs, history tables, updating summary tables, notifications |

By operation:

- **INSERT:** BEFORE can validate or fill in `NEW`. AFTER can log the new row (for example its generated id).
- **UPDATE:** BEFORE can compare `OLD` and `NEW` and adjust or block the change. AFTER can write the old and new values to an audit table.
- **DELETE:** BEFORE can block a delete (`RETURN NULL` or raise an error) and must `RETURN OLD` to let it proceed. AFTER can archive the deleted `OLD` row.

### Worked example: AFTER audit trigger

```sql
CREATE TABLE salary_audit (
    id          SERIAL PRIMARY KEY,
    emp_id      INT,
    old_salary  NUMERIC,
    new_salary  NUMERIC,
    op          TEXT,
    changed_at  TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION trg_audit_emp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO salary_audit(emp_id, new_salary, op)
        VALUES (NEW.emp_id, NEW.salary, TG_OP);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO salary_audit(emp_id, old_salary, new_salary, op)
        VALUES (NEW.emp_id, OLD.salary, NEW.salary, TG_OP);
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO salary_audit(emp_id, old_salary, op)
        VALUES (OLD.emp_id, OLD.salary, TG_OP);
    END IF;
    RETURN NULL;              -- ignored for AFTER triggers
END;
$$;

CREATE TRIGGER after_emp_change
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW
EXECUTE FUNCTION trg_audit_emp();
```

Test it:

```sql
INSERT INTO employees VALUES (8, 'nadia khan', 39000, 'IT');
UPDATE employees SET salary = 45000 WHERE emp_id = 8;
DELETE FROM employees WHERE emp_id = 8;
SELECT emp_id, old_salary, new_salary, op FROM salary_audit;
```

| emp\_id | old\_salary | new\_salary | op |
| --- | --- | --- | --- |
| 8 |  | 39000 | INSERT |
| 8 | 39000 | 45000 | UPDATE |
| 8 | 45000 |  | DELETE |

With the BEFORE trigger from Step 2 also in place, the inserted name is saved as "Nadia Khan".

## NoSQL and MongoDB basics

MongoDB is a document database: it stores JSON-like documents in collections, each document can have its own fields, and related data is often stored together instead of being split across tables.

### NoSQL families

| Type | Data model | Example |
| --- | --- | --- |
| Document | JSON/BSON documents | MongoDB, CouchDB |
| Key-value | A key mapped to a value | Redis, DynamoDB |
| Wide-column | Rows with flexible column families | Cassandra, HBase |
| Graph | Nodes and edges | Neo4j |

### SQL terms and their MongoDB equivalents

| SQL (RDBMS) | MongoDB |
| --- | --- |
| Database | Database |
| Table | Collection |
| Row (record, tuple) | Document |
| Column (field) | Field |
| Primary key | `_id` field |
| JOIN | Embedded documents, or `$lookup` in an aggregation |
| Index | Index |
| GROUP BY | `$group` stage |

### Practice data used in the MongoDB sections

A small library database with two collections. Run this in mongosh first.

```javascript
use library

db.authors.insertMany([
  { _id: 1, name: "Bano Qudsia",        country: "Pakistan" },
  { _id: 2, name: "Haruki Murakami",    country: "Japan" },
  { _id: 3, name: "Chimamanda Adichie", country: "Nigeria" }
])

db.books.insertMany([
  { _id: 11, title: "Raja Gidh",                  author_id: 1, genre: "Novel", price: 950,  year: 1981, tags: ["urdu", "classic"] },
  { _id: 12, title: "Kafka on the Shore",         author_id: 2, genre: "Novel", price: 1800, year: 2002, tags: ["fiction", "surreal"] },
  { _id: 13, title: "Norwegian Wood",             author_id: 2, genre: "Novel", price: 1500, year: 1987, tags: ["fiction"] },
  { _id: 14, title: "We Should All Be Feminists", author_id: 3, genre: "Essay", price: 600,  year: 2014, tags: ["essay"] },
  { _id: 15, title: "Untitled Draft",             author_id: 9, genre: "Essay", price: 400,  year: 2025, tags: [] }
])
```

Book 15 points to an author that does not exist, so you can see how joins treat missing matches.

### Documents, BSON and \_id

```javascript
{
  _id: ObjectId("6720f1a2c3b4d5e6f7a8b9c0"),
  title: "Kafka on the Shore",
  tags: ["fiction", "surreal"],                       // array
  publisher: { name: "Harvill", city: "London" }      // embedded document
}
```

- MongoDB stores documents on disk in **BSON (Binary JSON)**. BSON is faster to scan than text JSON and adds types JSON lacks: ObjectId, Date, Int32/Int64, Decimal128 and binary data.
- Every document must have a unique **`_id`** field, which acts as the primary key. If you do not supply one, MongoDB generates a 12-byte ObjectId (timestamp + random value + counter).
- One document can be at most 16 MB.

### Rigid schema vs flexible schema

|  | SQL / RDBMS (rigid schema) | NoSQL / MongoDB (flexible schema) |
| --- | --- | --- |
| Structure | Fixed tables; every row has the same columns, defined before data is inserted | Documents in one collection can have different fields; no schema needed in advance |
| Changing structure | `ALTER TABLE` migrations, which can be slow on large tables | Just start writing documents with the new field |
| Data integrity | Strong: data types, NOT NULL, CHECK, foreign keys enforced by the database | Weaker by default; the application (or optional JSON Schema validation, or Mongoose) must enforce it |
| Relationships | Normalized tables joined with foreign keys | Embedded documents or references; joins are less central |
| Transactions | Full ACID across many tables | ACID per document; multi-document transactions exist but cost more |
| Querying | Standard SQL, powerful joins and ad hoc queries | Query API and aggregation pipelines |
| Scaling | Usually vertical (bigger server) | Built for horizontal scaling (sharding across servers) |
| Best fit | Stable, highly related data: banking, ERP, accounting | Evolving or semi-structured data: catalogs, content, logs, IoT, fast prototyping |

In one line: a rigid schema buys consistency and integrity at the cost of flexibility; a flexible schema buys agility and easy scaling at the cost of the database enforcing less.

### Data structures compared

- **Relational:** data lives in two-dimensional tables of rows and columns. Each cell holds one atomic value (first normal form), so a book's list of tags needs a separate table.
- **Document:** data lives in nested, hierarchical documents. A field can hold an array or a sub-document, so the tags sit inside the book document.
- **Relational schema:** schema-on-write. The table definition is checked on every insert.
- **Document schema:** schema-on-read. The application interprets whatever fields are present when it reads.

### Relationships: embedding, referencing and joins

SQL models relationships with foreign keys across normalized tables and rebuilds them at query time with `JOIN`:

```sql
SELECT b.title, a.name
FROM books b
JOIN authors a ON b.author_id = a.author_id;
```

MongoDB offers two ways to model the same relationship:

**1. Embedding (denormalized):** put the related data inside the document. One read returns everything and no join is needed.

```javascript
{ _id: 13, title: "Norwegian Wood", author: { _id: 2, name: "Haruki Murakami" } }
```

**2. Referencing (normalized):** store the related document's `_id`, like a foreign key. Data is not duplicated, but you need `$lookup` (in the database) or Mongoose `populate()` (in the application) to combine it.

```javascript
// books
{ _id: 13, title: "Norwegian Wood", author_id: 2 }
// authors
{ _id: 2, name: "Haruki Murakami" }
```

|  | SQL JOIN | MongoDB embedding | MongoDB referencing |
| --- | --- | --- | --- |
| How related data is stored | Separate tables + foreign key | Inside the parent document | Separate collections + stored `_id` |
| How it is combined | `JOIN` in the query | Already together | `$lookup` stage or `populate()` |
| Integrity enforced? | Yes, foreign key constraints | Not needed (one document) | No, references are not checked |
| Read speed | Join cost grows with table size | Fastest: one document read | Extra lookup work per query |
| Duplication | None (normalized) | Possible, data copied into many documents | None |
| Use when | Many-to-many, strong consistency | One-to-one or one-to-few, data read together | One-to-many with large or shared children, many-to-many |

### CRUD in mongosh

```javascript
show collections

// Create
db.books.insertOne({ _id: 16, title: "Aangan", author_id: 4, genre: "Novel", price: 1100 })

// Read
db.books.find()                        // all documents
db.books.findOne({ _id: 12 })          // first match only
db.books.find({ genre: "Essay" })      // filter
db.books.countDocuments({ genre: "Novel" })

// Update
db.books.updateOne({ _id: 16 }, { $set: { price: 1200 } })
db.books.updateMany({ genre: "Essay" }, { $inc: { price: 50 } })

// Delete
db.books.deleteOne({ _id: 16 })
db.books.deleteMany({ year: { $lt: 1900 } })
```

### find(filter, projection), sort and limit

`find()` takes two documents: the **filter** (which documents) and the **projection** (which fields). Cursor methods are chained after it.

```javascript
db.books.find(
  { genre: "Novel" },              // filter
  { _id: 0, title: 1, price: 1 }   // projection: hide _id, show title and price
).sort({ price: -1 }).limit(2)
// Kafka on the Shore 1800, Norwegian Wood 1500
```

- Projection: `1` includes a field, `0` excludes it. `_id` is shown unless you write `_id: 0`. Do not mix 1 and 0 in one projection, except for `_id`.
- `{ _id: 0 }` on its own returns every field except `_id`.
- `sort({ field: 1 })` is ascending (A to Z, small to large); `-1` is descending.
- `limit(n)` keeps n documents; `skip(n)` skips n.

### Query operators

| Operator | Meaning | Example |
| --- | --- | --- |
| `$eq` | Equal (the default) | `{ genre: "Novel" }` |
| `$ne` | Not equal | `{ genre: { $ne: "Novel" } }` |
| `$gt`, `$gte` | Greater than (or equal) | `{ price: { $gt: 1000 } }` |
| `$lt`, `$lte` | Less than (or equal) | `{ year: { $lte: 1990 } }` |
| `$in`, `$nin` | In / not in a list | `{ author_id: { $in: [1, 3] } }` |
| `$and` | All conditions | `{ $and: [{ genre: "Novel" }, { price: { $lt: 1600 } }] }` |
| `$or` | Any condition | `{ $or: [{ year: { $lt: 1985 } }, { price: { $lt: 700 } }] }` |
| `$exists` | Field present or absent | `{ isbn: { $exists: true } }` |
| `$regex` | Pattern match | `{ title: { $regex: "^N" } }` |
| (array match) | Array contains a value | `{ tags: "fiction" }` |

Two conditions in one filter document are combined with AND: `{ genre: "Novel", author_id: 2 }`.

## MongoDB aggregation, $lookup and Mongoose

An aggregation pipeline passes documents through a list of stages, each transforming the stream; `$lookup` is the stage that joins a second collection inside the database. Examples use the library data from the previous section.

### Pipeline stages

| Stage | SQL equivalent | What it does |
| --- | --- | --- |
| `$match` | WHERE | Keeps documents that match a filter (put it early to cut work) |
| `$project` | SELECT column list | Includes, excludes, renames or computes fields |
| `$sort` | ORDER BY | Orders documents |
| `$limit`, `$skip` | LIMIT, OFFSET | Paging |
| `$group` | GROUP BY + aggregates | Groups by `_id` and computes `$sum`, `$avg`, `$min`, `$max`, `$push` |
| `$lookup` | LEFT OUTER JOIN | Adds an array of matching documents from another collection |
| `$unwind` | (flattening) | Splits a document with an array field into one document per array element |
| `$count` | COUNT(\*) | Counts documents reaching this stage |

```javascript
// Number of books and average price per genre
db.books.aggregate([
  { $group: { _id: "$genre", books: { $sum: 1 }, avg_price: { $avg: "$price" } } },
  { $sort: { books: -1 } }
])
// { _id: "Novel", books: 3, avg_price: 1416.67 }
// { _id: "Essay", books: 2, avg_price: 500 }
```

Inside a stage, `"$field"` (with a dollar sign) means "the value of this field". `$group` always needs an `_id`, which is the grouping key (`_id: null` puts everything in one group).

### $unwind

```javascript
db.books.aggregate([
  { $match: { _id: 11 } },
  { $unwind: "$tags" }
])
// { _id: 11, title: "Raja Gidh", ..., tags: "urdu" }
// { _id: 11, title: "Raja Gidh", ..., tags: "classic" }
```

A document whose array is empty or missing produces no output unless you write `{ $unwind: { path: "$tags", preserveNullAndEmptyArrays: true } }`. `$unwind` followed by `$group` is how you count array values, for example how many books carry each tag.

### $lookup

```javascript
{
  $lookup: {
    from: "<other collection>",
    localField: "<field in this collection>",
    foreignField: "<field in the other collection>",
    as: "<name of the new array field>"
  }
}
```

- The result is always an **array**, even when only one document matches.
- A document with no match is kept, with an empty array, like a LEFT OUTER JOIN.
- `localField` and `foreignField` can be any fields with matching values, not only `_id`.
- Follow with `$unwind` to turn the one-element array into a single embedded document.

Many-to-one: each book with its author.

```javascript
db.books.aggregate([
  { $lookup: {
      from: "authors",
      localField: "author_id",
      foreignField: "_id",
      as: "author"
  } }
])
// { _id: 13, title: "Norwegian Wood", author_id: 2, ..., author: [ { _id: 2, name: "Haruki Murakami", country: "Japan" } ] }
// { _id: 15, title: "Untitled Draft", author_id: 9, ..., author: [] }      // no author 9
```

One-to-many: each author with all their books.

```javascript
db.authors.aggregate([
  { $lookup: { from: "books", localField: "_id", foreignField: "author_id", as: "books" } },
  { $project: { _id: 0, name: 1, titles: "$books.title" } }
])
// { name: "Bano Qudsia",        titles: ["Raja Gidh"] }
// { name: "Haruki Murakami",    titles: ["Kafka on the Shore", "Norwegian Wood"] }
// { name: "Chimamanda Adichie", titles: ["We Should All Be Feminists"] }
```

Flattened report with `$unwind` and `$project`:

```javascript
db.books.aggregate([
  { $lookup: { from: "authors", localField: "author_id", foreignField: "_id", as: "author" } },
  { $unwind: "$author" },                       // drops book 15, which has no author
  { $project: { _id: 0, title: 1, author: "$author.name", price: 1 } },
  { $sort: { price: -1 } }
])
// Kafka on the Shore / Haruki Murakami / 1800 ... 4 documents
```

### Mongoose populate() vs $lookup

|  | Mongoose `.populate()` | MongoDB `$lookup` |
| --- | --- | --- |
| Where the join happens | In the Node.js application: Mongoose runs a second query and merges results in memory | Inside the MongoDB server, in one aggregation pipeline |
| Number of queries | Two or more round trips | One |
| What it needs | A schema field with a `ref` to another model | Just collection and field names |
| Returns | Mongoose documents with the reference replaced by the full document | Plain documents with a new array field |
| Good for | Simple CRUD code in an Express/Node app | Reports, large joins, combined filtering and grouping |

### Schema setup for populate()

`populate()` only works if the referencing field is declared in the schema with the **`ref` option naming the target model**, and its `type` matches the target's `_id` type (usually `Schema.Types.ObjectId`).

```javascript
const mongoose = require("mongoose");
const { Schema } = mongoose;

const authorSchema = new Schema({
  name: String,
  country: String
});
const Author = mongoose.model("Author", authorSchema);

const bookSchema = new Schema({
  title: String,
  price: Number,
  author: { type: Schema.Types.ObjectId, ref: "Author" }   // the key line
});
const Book = mongoose.model("Book", bookSchema);

// Replace the stored ObjectId with the full author document
const books = await Book.find().populate("author");
// Pick only some fields of the author
const slim = await Book.find().populate("author", "name");
```

Checklist: (1) the field has `ref: "<ModelName>"`, (2) its `type` matches the referenced `_id`, (3) the referenced model is registered with `mongoose.model()` under that same name, (4) the field stores the referenced document's `_id`.

### Indexes

```javascript
db.books.createIndex({ author_id: 1 })               // single field, ascending
db.authors.createIndex({ name: 1 }, { unique: true })
db.books.find({ author_id: 2 }).explain("executionStats")   // IXSCAN = index used, COLLSCAN = full scan
```

An index on `foreignField` makes `$lookup` much faster, just as an index on a foreign key speeds up a SQL join.

## Practice questions and model answers

Try each question before reading its answer. The PL/pgSQL questions use the employees table and the MongoDB questions use the library collections, both with their original data.

### Part A: multiple choice

1. Which operator assigns a value to a PL/pgSQL variable? a) `==` b) `:=` c) `<-` d) `=>`
2. Which declaration copies the data type of a table column? a) `%ROWTYPE` b) `%TYPE` c) `RECORD` d) `REFCURSOR`
3. What does `FOR i IN 1..10 BY 3 LOOP` produce? a) 1, 4, 7, 10 b) 3, 6, 9 c) 1, 3, 5, 7, 9 d) 10, 7, 4, 1
4. After the last row of a cursor has been read, the next FETCH: a) raises an error b) sets FOUND to false c) restarts at row 1 d) sets the variables to zero
5. Which trigger timing can change a row before it is written? a) AFTER b) BEFORE c) FOR EACH STATEMENT d) DEFERRED
6. A trigger function must be declared with which return type? a) VOID b) RECORD c) TRIGGER d) SETOF RECORD
7. Which projection shows only the title, with no `_id`? a) `{ title: 1 }` b) `{ _id: 0, title: 1 }` c) `{ title: 0 }` d) `{ _id: 1, title: 0 }`
8. Which filter finds books priced at 1000 or less? a) `{ price: { $lt: 1000 } }` b) `{ price: { $lte: 1000 } }` c) `{ price: { $max: 1000 } }` d) `{ price: "<=1000" }`
9. In a `$group` stage the grouping key is written in which field? a) `key` b) `by` c) `_id` d) `group`
10. What does `$lookup` put in the new field when nothing matches? a) It raises an error b) It removes the document c) An empty array d) The string "null"

Answers: 1 b, 2 b, 3 a, 4 b, 5 b, 6 c, 7 b, 8 b, 9 c, 10 c.

### Part B: short answers

**B1. Write a function that returns the total salary of a department, returning 0 for an unknown department.**

```sql
CREATE OR REPLACE FUNCTION dept_payroll(p_dept TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    SELECT COALESCE(SUM(salary), 0) INTO v_total
    FROM employees WHERE dept = p_dept;
    RETURN v_total;
END;
$$;

SELECT dept_payroll('IT');      -- 147000
SELECT dept_payroll('Sales');   -- 0
```

**B2. Write a procedure that moves an employee to another department, raises an error if the employee does not exist, and commits.**

```sql
CREATE OR REPLACE PROCEDURE move_employee(p_id INT, p_new_dept TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE employees SET dept = p_new_dept WHERE emp_id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % not found', p_id;
    END IF;
    COMMIT;
END;
$$;

CALL move_employee(7, 'IT');
```

Why a procedure and not a function: it changes data as a standalone action and commits, and nothing needs to be returned to a query.

**B3. Write a trigger that stops any salary from being reduced.**

```sql
CREATE OR REPLACE FUNCTION trg_no_pay_cut()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.salary < OLD.salary THEN
        RAISE EXCEPTION 'Salary of % cannot go down (% -> %)',
                        OLD.name, OLD.salary, NEW.salary;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER no_pay_cut
BEFORE UPDATE OF salary ON employees
FOR EACH ROW
EXECUTE FUNCTION trg_no_pay_cut();

UPDATE employees SET salary = 40000 WHERE emp_id = 1;
-- ERROR: Salary of Ali cannot go down (50000 -> 40000)
```

It must be BEFORE and row-level, because it compares each row's OLD and NEW values and must stop the write.

**B4. What happens if you FETCH from an explicit cursor you have not opened?** PostgreSQL raises an error (for a bound cursor it reports that the cursor variable is null). OPEN is what runs the query, so there is nothing to fetch until then.

**B5. Explain why a list of tags is simpler to store in MongoDB than in a relational table.** A relational cell holds one atomic value, so tags need a second table (book\_id, tag) and a join to read them back. A MongoDB field can hold an array, so the tags stay inside the book document and come back with it in one read.

**B6. Give two situations where $lookup is a better choice than populate().** When the join feeds a report that also filters, groups or sorts on the joined data, because the whole pipeline runs in the database in one query. And when you are not using Mongoose at all, for example in mongosh or another driver.

### Part C: programs

**C1. Print the squares of 1 to 8 with a WHILE loop.**

```sql
DO $$
DECLARE
    i INTEGER := 1;
BEGIN
    WHILE i <= 8 LOOP
        RAISE NOTICE '% squared = %', i, i * i;
        i := i + 1;
    END LOOP;
END $$;
-- 1, 4, 9, 16, 25, 36, 49, 64
```

**C2. Use a cursor with a parameter to list employees earning more than 60,000, highest first.**

```sql
DO $$
DECLARE
    cur_high CURSOR (p_min NUMERIC) FOR
        SELECT name, salary FROM employees
        WHERE salary > p_min ORDER BY salary DESC;
    rec RECORD;
BEGIN
    OPEN cur_high(60000);
    LOOP
        FETCH cur_high INTO rec;
        EXIT WHEN NOT FOUND;
        RAISE NOTICE '% %', rec.name, rec.salary;
    END LOOP;
    CLOSE cur_high;
END $$;
-- Hina, Sara, Zara
```

**C3. Use a scrollable cursor to find the lowest-paid employee.**

```sql
DO $$
DECLARE
    cur SCROLL CURSOR FOR SELECT name, salary FROM employees ORDER BY salary DESC;
    rec RECORD;
BEGIN
    OPEN cur;
    FETCH LAST FROM cur INTO rec;
    RAISE NOTICE 'Lowest paid: % (%)', rec.name, rec.salary;   -- Bilal (42000)
    CLOSE cur;
END $$;
```

**C4. MongoDB: books cheaper than 1000, showing only title and year, oldest first.**

```javascript
db.books.find({ price: { $lt: 1000 } }, { _id: 0, title: 1, year: 1 }).sort({ year: 1 })
// Raja Gidh 1981, We Should All Be Feminists 2014, Untitled Draft 2025
```

**C5. MongoDB: number of books per author, with the author's name.**

```javascript
db.books.aggregate([
  { $group: { _id: "$author_id", books: { $sum: 1 } } },
  { $lookup: { from: "authors", localField: "_id", foreignField: "_id", as: "author" } },
  { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
  { $project: { _id: 0, author_id: "$_id", name: "$author.name", books: 1 } },
  { $sort: { books: -1 } }
])
// Haruki Murakami 2, then Bano Qudsia 1, Chimamanda Adichie 1, and author 9 (no name) 1
```

**C6. MongoDB: how many books carry each tag?**

```javascript
db.books.aggregate([
  { $unwind: "$tags" },
  { $group: { _id: "$tags", books: { $sum: 1 } } },
  { $sort: { books: -1, _id: 1 } }
])
// fiction 2, then classic, essay, surreal, urdu with 1 each
```

### Self-check

- [ ] I can write a complete DO block with DECLARE, BEGIN, END and `$$ LANGUAGE plpgsql;` from memory.
- [ ] I can write the same task with FOR, WHILE and LOOP/EXIT, and use BY, REVERSE and `%`.
- [ ] I can write, call and compare a function and a procedure.
- [ ] I can explain implicit vs explicit cursors and SELECT INTO vs FETCH INTO.
- [ ] I can use every FETCH direction on a SCROLL cursor and predict the row it returns.
- [ ] I can write BEFORE and AFTER triggers and say what OLD and NEW hold for each operation.
- [ ] I can map SQL terms to MongoDB and argue both sides of rigid vs flexible schema.
- [ ] I can write find with filters, projection and sort, and pipelines with $match, $group, $lookup and $unwind.
- [ ] I can set up a Mongoose schema so that populate() works.

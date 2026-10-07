# Cursors & Triggers in PL/pgSQL

Oct 5, 2026 · @Asim Riaz

## 1. Setup: the sample database

Every example in this tutorial runs against the same four tables, so build them once before you start. All code was tested on PostgreSQL 16 and works on 12 and later.

- **departments** — teams and their budgets
- **employees** — staff, with salary and a running `total_sales` figure that a trigger will maintain
- **orders** — sales made by employees
- **audit\_log** — a generic change log that triggers will write into

```sql
CREATE TABLE departments (
    dept_id   serial PRIMARY KEY,
    name      text NOT NULL UNIQUE,
    budget    numeric(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE employees (
    emp_id      serial PRIMARY KEY,
    name        text NOT NULL,
    email       text,
    dept_id     int REFERENCES departments(dept_id),
    salary      numeric(10,2) NOT NULL,
    total_sales numeric(12,2) NOT NULL DEFAULT 0,
    hired_on    date NOT NULL DEFAULT current_date,
    updated_at  timestamptz
);

CREATE TABLE orders (
    order_id   serial PRIMARY KEY,
    emp_id     int REFERENCES employees(emp_id),
    customer   text NOT NULL,
    amount     numeric(10,2) NOT NULL,
    status     text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
    id         bigserial PRIMARY KEY,
    table_name text NOT NULL,
    operation  text NOT NULL,
    row_id     int,
    old_data   jsonb,
    new_data   jsonb,
    changed_by text NOT NULL DEFAULT current_user,
    changed_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO departments (name, budget) VALUES
  ('Engineering', 500000), ('Sales', 300000), ('HR', 120000);

INSERT INTO employees (name, email, dept_id, salary, hired_on) VALUES
  ('Ayesha Khan', 'ayesha@corp.pk', 1, 180000, '2021-03-15'),
  ('Bilal Ahmed', 'bilal@corp.pk',  1, 150000, '2022-07-01'),
  ('Sana Malik',  'sana@corp.pk',   2,  95000, '2020-01-10'),
  ('Usman Tariq', 'usman@corp.pk',  2,  88000, '2023-05-20'),
  ('Hina Raza',   'hina@corp.pk',   3,  70000, '2019-11-03');

INSERT INTO orders (emp_id, customer, amount, status) VALUES
  (3, 'Alpha Traders', 25000, 'shipped'),
  (3, 'Beta Foods',    12000, 'pending'),
  (4, 'Gamma Tech',    40000, 'shipped'),
  (4, 'Delta Pharma',   8000, 'cancelled');
```

Tip: `RAISE NOTICE` output is how most examples show their results. In psql it prints automatically; in pgAdmin or DBeaver look in the Messages / Output tab.

## 2. Cursors: the basics

A cursor is a pointer into a query's result that lets you read the rows one at a time instead of loading them all into memory. PostgreSQL runs the query lazily and hands you rows as you ask for them, which matters when a result has millions of rows.

### 2.1 The implicit cursor: FOR … IN query LOOP

The easiest way to use a cursor is to not declare one. A `FOR` loop over a query opens a cursor behind the scenes, fetches rows in batches of 10, and closes it when the loop ends.

```sql
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT name, salary FROM employees ORDER BY salary DESC LOOP
        RAISE NOTICE '% earns %', r.name, r.salary;
    END LOOP;
END $$;
```

Output:

```text
NOTICE:  Ayesha Khan earns 180000.00
NOTICE:  Bilal Ahmed earns 150000.00
NOTICE:  Sana Malik earns 95000.00
NOTICE:  Usman Tariq earns 88000.00
NOTICE:  Hina Raza earns 70000.00
```

Use this form whenever you simply need to visit every row. Reach for an explicit cursor only when you need the extra control described next.

### 2.2 The explicit cursor lifecycle

An explicit cursor always goes through the same four steps:

1. **DECLARE** — name the cursor and bind it to a query in the `DECLARE` section. Nothing runs yet.
2. **OPEN** — the query is planned and execution starts.
3. **FETCH** — pull the next row into variables. The special variable `FOUND` becomes `false` when there are no more rows.
4. **CLOSE** — release the cursor's resources. (Cursors also close automatically at the end of the transaction.)

```sql
DO $$
DECLARE
    cur_emp CURSOR FOR
        SELECT emp_id, name, salary FROM employees WHERE dept_id = 1;
    v_id     employees.emp_id%TYPE;
    v_name   employees.name%TYPE;
    v_salary employees.salary%TYPE;
    v_total  numeric := 0;
BEGIN
    OPEN cur_emp;
    LOOP
        FETCH cur_emp INTO v_id, v_name, v_salary;
        EXIT WHEN NOT FOUND;          -- stop after the last row
        v_total := v_total + v_salary;
        RAISE NOTICE '#% %: %', v_id, v_name, v_salary;
    END LOOP;
    CLOSE cur_emp;
    RAISE NOTICE 'Engineering payroll: %', v_total;
END $$;
```

Output:

```text
NOTICE:  #1 Ayesha Khan: 180000.00
NOTICE:  #2 Bilal Ahmed: 150000.00
NOTICE:  Engineering payroll: 330000.00
```

Things to notice:

- `%TYPE` copies a column's data type, so the variables stay correct if the table changes.
- `EXIT WHEN NOT FOUND` must come straight after `FETCH`. Put it later and the loop processes the last row twice.
- Fetching from a cursor that is not open, or opening one that is already open, raises an error.

### 2.3 Looping over a declared cursor

You can also hand a declared (bound) cursor to a `FOR` loop. The loop opens it, declares the loop variable as a record for you, and closes it at the end.

```sql
DO $$
DECLARE
    cur_dept CURSOR FOR SELECT * FROM departments ORDER BY dept_id;
BEGIN
    FOR d IN cur_dept LOOP          -- d is declared automatically
        RAISE NOTICE 'Dept % has budget %', d.name, d.budget;
    END LOOP;
END $$;
```

This gives you a named, reusable query with the convenience of the implicit loop.

## 3. Cursors: going further

### 3.1 Parameterized cursors

A cursor can take arguments, so one declaration serves many queries. Pass them when you `OPEN` it or in the `FOR` loop, by position or by name.

```sql
DO $$
DECLARE
    cur_by_dept CURSOR (p_dept int, p_min numeric) FOR
        SELECT name, salary FROM employees
        WHERE dept_id = p_dept AND salary >= p_min
        ORDER BY salary DESC;
    r record;
BEGIN
    OPEN cur_by_dept(1, 160000);                       -- positional
    LOOP
        FETCH cur_by_dept INTO r;
        EXIT WHEN NOT FOUND;
        RAISE NOTICE 'Eng >= 160k: %', r.name;
    END LOOP;
    CLOSE cur_by_dept;

    FOR r IN cur_by_dept(p_dept := 2, p_min := 0) LOOP -- named
        RAISE NOTICE 'Sales: % (%)', r.name, r.salary;
    END LOOP;
END $$;
```

```text
NOTICE:  Eng >= 160k: Ayesha Khan
NOTICE:  Sales: Sana Malik (95000.00)
NOTICE:  Sales: Usman Tariq (88000.00)
```

### 3.2 Unbound cursors (refcursor) and dynamic SQL

A variable of type `refcursor` is not tied to a query until you open it. That lets you choose the query at run time, including dynamic SQL built with `format()`.

```sql
DO $$
DECLARE
    c       refcursor;
    v_table text := 'departments';
    v_count int;
BEGIN
    OPEN c FOR EXECUTE format('SELECT count(*) FROM %I', v_table);
    FETCH c INTO v_count;
    CLOSE c;
    RAISE NOTICE '% has % rows', v_table, v_count;   -- departments has 3 rows
END $$;
```

Always build dynamic SQL with `format('%I', …)` for identifiers and `%L` or `USING` for values. String concatenation invites SQL injection.

### 3.3 Returning a cursor from a function

A function can open a cursor and return its name. The caller then fetches from it, in pages if needed. This is a common way for applications to stream large results. The cursor lives until the transaction ends, so the call and the fetches must be in the same transaction.

```sql
CREATE OR REPLACE FUNCTION get_employees_by_dept(p_dept int)
RETURNS refcursor
LANGUAGE plpgsql AS $$
DECLARE
    c refcursor := 'emp_cur';     -- give the portal a fixed name
BEGIN
    OPEN c FOR
        SELECT emp_id, name, salary FROM employees
        WHERE dept_id = p_dept ORDER BY emp_id;
    RETURN c;
END $$;

BEGIN;
SELECT get_employees_by_dept(1);   -- returns 'emp_cur'
FETCH ALL FROM emp_cur;            -- or FETCH 100 FROM emp_cur;
COMMIT;
```

To return several result sets at once, return `SETOF refcursor` and let the caller name each cursor:

```sql
CREATE OR REPLACE FUNCTION dept_report(p_dept int, c_emp refcursor, c_ord refcursor)
RETURNS SETOF refcursor
LANGUAGE plpgsql AS $$
BEGIN
    OPEN c_emp FOR SELECT name, salary FROM employees WHERE dept_id = p_dept;
    RETURN NEXT c_emp;
    OPEN c_ord FOR SELECT o.* FROM orders o JOIN employees e USING (emp_id)
                   WHERE e.dept_id = p_dept;
    RETURN NEXT c_ord;
END $$;

BEGIN;
SELECT * FROM dept_report(2, 'emps', 'ords');
FETCH ALL FROM emps;
FETCH ALL FROM ords;
COMMIT;
```

### 3.4 Scrollable cursors, FETCH directions and MOVE

By default a cursor should only move forward. Declare it `SCROLL` to move in any direction. `MOVE` repositions the cursor without reading a row.

| Direction | Meaning |
| --- | --- |
| `NEXT` (default) | The row after the current one |
| `PRIOR` | The row before the current one (needs SCROLL) |
| `FIRST` / `LAST` | The first / last row |
| `ABSOLUTE n` | Row number n (negative counts from the end) |
| `RELATIVE n` | n rows from the current position |
| `FORWARD n` / `BACKWARD n` | n rows forward / back (mainly with MOVE) |

```sql
DO $$
DECLARE
    c SCROLL CURSOR FOR SELECT name FROM employees ORDER BY emp_id;
    v text;
BEGIN
    OPEN c;
    FETCH LAST  FROM c INTO v;      RAISE NOTICE 'last:       %', v;
    FETCH PRIOR FROM c INTO v;      RAISE NOTICE 'prior:      %', v;
    FETCH FIRST FROM c INTO v;      RAISE NOTICE 'first:      %', v;
    FETCH ABSOLUTE 3 FROM c INTO v; RAISE NOTICE 'absolute 3: %', v;
    MOVE FORWARD 1 FROM c;          -- skip a row without reading it
    FETCH NEXT FROM c INTO v;       RAISE NOTICE 'after move: %', v;
    CLOSE c;
END $$;
```

```text
NOTICE:  last:       Hina Raza
NOTICE:  prior:      Usman Tariq
NOTICE:  first:      Ayesha Khan
NOTICE:  absolute 3: Sana Malik
NOTICE:  after move: Hina Raza
```

### 3.5 Updating rows through a cursor: WHERE CURRENT OF

`UPDATE … WHERE CURRENT OF cursor` changes exactly the row the cursor is on. Add `FOR UPDATE` to the cursor's query so each row is locked as you reach it. The example gives a raise based on length of service.

```sql
DO $$
DECLARE
    c CURSOR FOR
        SELECT emp_id, salary, hired_on FROM employees FOR UPDATE;
    v_raise numeric;
BEGIN
    FOR r IN c LOOP
        v_raise := CASE
            WHEN r.hired_on < DATE '2021-01-01' THEN 0.10
            WHEN r.hired_on < DATE '2023-01-01' THEN 0.05
            ELSE 0.02 END;
        UPDATE employees
        SET    salary = round(salary * (1 + v_raise), 2)
        WHERE  CURRENT OF c;
    END LOOP;
END $$;
```

| Employee | Hired | Old salary | New salary |
| --- | --- | --- | --- |
| Ayesha Khan | 2021-03-15 | 180,000 | 189,000 |
| Bilal Ahmed | 2022-07-01 | 150,000 | 157,500 |
| Sana Malik | 2020-01-10 | 95,000 | 104,500 |
| Usman Tariq | 2023-05-20 | 88,000 | 89,760 |
| Hina Raza | 2019-11-03 | 70,000 | 77,000 |

Wrap this in `BEGIN; … ROLLBACK;` while experimenting so your sample data stays unchanged for the next sections.

## 4. When to use a cursor (and when not to)

If one SQL statement can do the job, it will almost always beat a cursor loop. The raise from 3.5 is a single statement:

```sql
UPDATE employees
SET salary = round(salary * (1 + CASE
        WHEN hired_on < DATE '2021-01-01' THEN 0.10
        WHEN hired_on < DATE '2023-01-01' THEN 0.05
        ELSE 0.02 END), 2);
```

The loop version runs one `UPDATE` per row; this runs one `UPDATE` in total. On large tables that difference is often 10–100×.

| Situation | Use |
| --- | --- |
| Same change applied to many rows | Plain set-based SQL |
| Visit each row, logic is simple | `FOR r IN query LOOP` |
| Need to stop early, peek, or fetch in steps | Explicit cursor with `FETCH` |
| Same query with different filters | Parameterized cursor |
| Query text decided at run time | `refcursor` + `OPEN … FOR EXECUTE` |
| Application must stream a large result | Function returning `refcursor` |
| Each row needs a call to another function or an external side effect | Cursor loop |
| Very long job that must commit in batches | Cursor loop inside a `PROCEDURE` with `COMMIT` |

### Batch commits inside a procedure

Since PostgreSQL 11, a procedure (not a function) can `COMMIT` inside a `FOR` loop. This keeps locks and transaction size small on long jobs.

```sql
CREATE OR REPLACE PROCEDURE archive_shipped_orders(p_batch int DEFAULT 1000)
LANGUAGE plpgsql AS $$
DECLARE
    r record;
    n int := 0;
BEGIN
    FOR r IN SELECT order_id FROM orders WHERE status = 'shipped' ORDER BY order_id LOOP
        UPDATE orders SET status = 'archived' WHERE order_id = r.order_id;
        n := n + 1;
        IF n % p_batch = 0 THEN
            COMMIT;
            RAISE NOTICE 'committed % rows', n;
        END IF;
    END LOOP;
    COMMIT;
    RAISE NOTICE 'done: % rows', n;
END $$;

CALL archive_shipped_orders(1);   -- tiny batch size just to see it work
```

### Best practices

- Always `CLOSE` explicit cursors you open; leaked cursors hold memory and locks until the transaction ends.
- Put `EXIT WHEN NOT FOUND` immediately after each `FETCH`.
- Use `%TYPE` and `%ROWTYPE` for fetch targets.
- Add `ORDER BY` whenever row order matters; without it the order is not guaranteed.
- Use `FOR UPDATE` on the cursor query when you plan to change the rows you read.
- Name returned cursors explicitly so callers know what to `FETCH` from.

## 5. Triggers: the basics

A trigger tells PostgreSQL to run a function automatically when a table is changed. You build one in two steps: write a **trigger function**, then attach it with **CREATE TRIGGER**. The same function can be attached to many tables.

### 5.1 Anatomy of a trigger

```sql
-- Step 1: the trigger function. No parameters, returns type trigger.
CREATE OR REPLACE FUNCTION my_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    -- your logic here
    RETURN NEW;      -- or OLD, or NULL (see 5.4)
END $$;

-- Step 2: attach it to a table.
CREATE TRIGGER my_trigger
    { BEFORE | AFTER | INSTEAD OF } { INSERT | UPDATE [OF col, ...] | DELETE | TRUNCATE }
    ON table_name
    [ REFERENCING { OLD | NEW } TABLE AS name ]
    FOR EACH { ROW | STATEMENT }
    [ WHEN ( condition ) ]
    EXECUTE FUNCTION my_trigger_fn( [ 'static', 'args' ] );
```

Events can be combined with `OR`, for example `AFTER INSERT OR UPDATE OR DELETE`.

### 5.2 Timing and level

|  | Row-level (FOR EACH ROW) | Statement-level (FOR EACH STATEMENT) |
| --- | --- | --- |
| Fires | Once per affected row | Once per SQL statement, even if 0 rows change |
| Sees NEW / OLD | Yes | No (use transition tables, 6.6) |
| BEFORE is used to | Validate or change the row before it is written; skip it | Check permissions or preconditions |
| AFTER is used to | Audit, update other tables, notify | Summary work, refresh totals once |
| INSTEAD OF | Only on views: replace the operation | Not allowed |

### 5.3 Special variables inside a trigger function

| Variable | Contains |
| --- | --- |
| `NEW` | The new row for INSERT / UPDATE (NULL for DELETE and statement triggers) |
| `OLD` | The old row for UPDATE / DELETE (NULL for INSERT and statement triggers) |
| `TG_OP` | `'INSERT'`, `'UPDATE'`, `'DELETE'` or `'TRUNCATE'` |
| `TG_WHEN` | `'BEFORE'`, `'AFTER'` or `'INSTEAD OF'` |
| `TG_LEVEL` | `'ROW'` or `'STATEMENT'` |
| `TG_NAME` | Name of the trigger that fired |
| `TG_TABLE_NAME` / `TG_TABLE_SCHEMA` | Table the trigger is on |
| `TG_RELID` | OID of that table |
| `TG_NARGS` / `TG_ARGV[]` | Arguments given in CREATE TRIGGER (as text, index from 0) |

### 5.4 What the function must return

- **BEFORE ROW:** return `NEW` (possibly modified) to go ahead, or `NULL` to silently skip this row. For DELETE, return `OLD` to go ahead.
- **AFTER ROW and all STATEMENT triggers:** the return value is ignored; `RETURN NULL` is the convention.
- **INSTEAD OF:** return `NEW` (or `OLD` for delete) to report the row as handled, `NULL` to report nothing done.
- To stop the whole statement, `RAISE EXCEPTION`. The entire statement, and every trigger's work, is rolled back.

### 5.5 See it in action: firing order

This one function prints its context. Attach it four ways and run one `UPDATE` that touches two rows.

```sql
CREATE OR REPLACE FUNCTION trg_show_context()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE NOTICE '% % % on % (level: %)',
        TG_NAME, TG_WHEN, TG_OP, TG_TABLE_NAME, TG_LEVEL;
    IF TG_LEVEL = 'ROW' THEN
        IF TG_OP IN ('UPDATE','DELETE') THEN RAISE NOTICE '   OLD = %', OLD; END IF;
        IF TG_OP IN ('INSERT','UPDATE') THEN RAISE NOTICE '   NEW = %', NEW; END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER t1_before_stmt BEFORE UPDATE ON departments
    FOR EACH STATEMENT EXECUTE FUNCTION trg_show_context();
CREATE TRIGGER t2_before_row  BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION trg_show_context();
CREATE TRIGGER t3_after_row   AFTER UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION trg_show_context();
CREATE TRIGGER t4_after_stmt  AFTER UPDATE ON departments
    FOR EACH STATEMENT EXECUTE FUNCTION trg_show_context();

UPDATE departments SET budget = budget + 1000 WHERE dept_id IN (1, 2);
```

```text
NOTICE:  t1_before_stmt BEFORE UPDATE on departments (level: STATEMENT)
NOTICE:  t2_before_row BEFORE UPDATE on departments (level: ROW)
NOTICE:     OLD = (1,Engineering,500000.00)
NOTICE:     NEW = (1,Engineering,501000.00)
NOTICE:  t2_before_row BEFORE UPDATE on departments (level: ROW)
NOTICE:     OLD = (2,Sales,300000.00)
NOTICE:     NEW = (2,Sales,301000.00)
NOTICE:  t3_after_row AFTER UPDATE on departments (level: ROW)
NOTICE:     OLD = (1,Engineering,500000.00)
NOTICE:     NEW = (1,Engineering,501000.00)
NOTICE:  t3_after_row AFTER UPDATE on departments (level: ROW)
NOTICE:     OLD = (2,Sales,300000.00)
NOTICE:     NEW = (2,Sales,301000.00)
NOTICE:  t4_after_stmt AFTER UPDATE on departments (level: STATEMENT)
```

Notice that both BEFORE ROW calls finish before either AFTER ROW call starts. AFTER ROW events are queued and run once the statement has changed every row. When several triggers share the same timing and level, they fire in **alphabetical order of trigger name**.

&#91;embedded content: trigger firing order for one statement · 6 steps\]

Steps 2–4 repeat for every row the statement touches; step 5 starts only once the loop is finished.

Clean up before moving on:

```sql
DROP TRIGGER t1_before_stmt ON departments;
DROP TRIGGER t2_before_row  ON departments;
DROP TRIGGER t3_after_row   ON departments;
DROP TRIGGER t4_after_stmt  ON departments;
UPDATE departments SET budget = budget - 1000 WHERE dept_id IN (1, 2);
```

## 6. Triggers: worked examples

Run these in order; each builds on the data left by the one before.

### 6.1 Auto-maintained timestamp (BEFORE UPDATE)

The most common trigger of all. A BEFORE trigger can change `NEW` before the row is written.

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

CREATE TRIGGER employees_set_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

UPDATE employees SET email = 'hina.raza@corp.pk' WHERE emp_id = 5;
SELECT name, email, updated_at FROM employees WHERE emp_id = 5;   -- updated_at is now filled
```

Because the function names no table, you can attach `set_updated_at()` to every table that has an `updated_at` column.

### 6.2 Validation and cleanup (BEFORE INSERT OR UPDATE)

This trigger normalises email addresses and enforces two business rules. `RAISE EXCEPTION` cancels the statement. Write `%%` to print a literal percent sign.

```sql
CREATE OR REPLACE FUNCTION validate_employee()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.email := lower(trim(NEW.email));

    IF NEW.salary <= 0 THEN
        RAISE EXCEPTION 'Salary must be positive (got %)', NEW.salary;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.salary > OLD.salary * 1.5 THEN
        RAISE EXCEPTION 'Raise for % exceeds 50%%: % -> %',
            NEW.name, OLD.salary, NEW.salary
            USING ERRCODE = 'check_violation',
                  HINT    = 'Large raises need HR approval.';
    END IF;

    RETURN NEW;
END $$;

CREATE TRIGGER employees_validate
    BEFORE INSERT OR UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION validate_employee();
```

Try it:

```sql
INSERT INTO employees (name, email, dept_id, salary)
VALUES ('Zara Ali', '  ZARA@Corp.PK ', 3, 65000);      -- stored as zara@corp.pk

UPDATE employees SET salary = 300000 WHERE emp_id = 4;
-- ERROR:  Raise for Usman Tariq exceeds 50%: 88000.00 -> 300000.00
-- HINT:  Large raises need HR approval.

INSERT INTO employees (name, dept_id, salary) VALUES ('Bad', 1, -5);
-- ERROR:  Salary must be positive (got -5.00)
```

A simple rule like `salary > 0` is better as a `CHECK` constraint. Use a trigger when the rule compares `OLD` with `NEW`, reads other tables, or changes the data.

### 6.3 A generic audit log (AFTER, with TG\_ARGV)

One function audits any table. The primary-key column name is passed as a trigger argument, and `to_jsonb()` turns the whole row into JSON.

```sql
CREATE OR REPLACE FUNCTION audit_changes()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_pk text := TG_ARGV[0];          -- name of the key column
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, operation, row_id, new_data)
        VALUES (TG_TABLE_NAME, TG_OP, (to_jsonb(NEW) ->> v_pk)::int, to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, operation, row_id, old_data, new_data)
        VALUES (TG_TABLE_NAME, TG_OP, (to_jsonb(NEW) ->> v_pk)::int, to_jsonb(OLD), to_jsonb(NEW));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, operation, row_id, old_data)
        VALUES (TG_TABLE_NAME, TG_OP, (to_jsonb(OLD) ->> v_pk)::int, to_jsonb(OLD));
    END IF;
    RETURN NULL;                      -- ignored for AFTER triggers
END $$;

CREATE TRIGGER employees_audit
    AFTER INSERT OR UPDATE OR DELETE ON employees
    FOR EACH ROW EXECUTE FUNCTION audit_changes('emp_id');

CREATE TRIGGER orders_audit
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION audit_changes('order_id');

UPDATE employees SET dept_id = 1 WHERE name = 'Zara Ali';
DELETE FROM employees WHERE name = 'Zara Ali';

SELECT id, table_name, operation, row_id,
       old_data ->> 'dept_id' AS old_dept,
       new_data ->> 'dept_id' AS new_dept
FROM audit_log ORDER BY id;
```

```text
 id | table_name | operation | row_id | old_dept | new_dept
----+------------+-----------+--------+----------+----------
  1 | employees  | UPDATE    |      6 | 3        | 1
  2 | employees  | DELETE    |      6 | 1        |
```

Audit in an AFTER trigger, not BEFORE: by then every BEFORE trigger has had its say, so you log the row as it was really stored.

### 6.4 Keeping a running total in another table

`employees.total_sales` should always equal the sum of that employee's **shipped** orders. The trigger must handle all three operations, including an order changing status or moving to another employee.

```sql
CREATE OR REPLACE FUNCTION maintain_total_sales()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- take the old row's contribution away
    IF TG_OP IN ('UPDATE','DELETE') AND OLD.status = 'shipped' THEN
        UPDATE employees SET total_sales = total_sales - OLD.amount
        WHERE emp_id = OLD.emp_id;
    END IF;
    -- add the new row's contribution
    IF TG_OP IN ('INSERT','UPDATE') AND NEW.status = 'shipped' THEN
        UPDATE employees SET total_sales = total_sales + NEW.amount
        WHERE emp_id = NEW.emp_id;
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER orders_total_sales
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION maintain_total_sales();

-- one-time backfill for rows that existed before the trigger
UPDATE employees e
SET total_sales = COALESCE((SELECT sum(amount) FROM orders o
                            WHERE o.emp_id = e.emp_id AND o.status = 'shipped'), 0);
```

Now change some orders and watch the totals follow:

| Step | Sana Malik | Usman Tariq |
| --- | --- | --- |
| After backfill | 25,000 | 40,000 |
| `UPDATE orders SET status = 'shipped' WHERE order_id = 2;` | 37,000 | 40,000 |
| `INSERT` a 5,000 shipped order for Usman | 37,000 | 45,000 |
| `DELETE FROM orders WHERE order_id = 1;` | 12,000 | 45,000 |

The "old out, new in" pattern is what makes it correct for every case, including an update that changes `emp_id`. Also note the chain: each `UPDATE employees` here fires the employee triggers from 6.1–6.3 too.

### 6.5 Fire only when it matters: UPDATE OF and WHEN

`UPDATE OF salary` limits the trigger to statements that set that column. The `WHEN` clause is checked before the function is even called, which is cheaper than an `IF` inside it.

```sql
CREATE TABLE salary_history (
    emp_id     int,
    old_salary numeric(10,2),
    new_salary numeric(10,2),
    changed_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION log_salary_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO salary_history (emp_id, old_salary, new_salary)
    VALUES (NEW.emp_id, OLD.salary, NEW.salary);
    RETURN NULL;
END $$;

CREATE TRIGGER employees_salary_history
    AFTER UPDATE OF salary ON employees
    FOR EACH ROW
    WHEN (OLD.salary IS DISTINCT FROM NEW.salary)
    EXECUTE FUNCTION log_salary_change();

UPDATE employees SET salary = salary WHERE emp_id = 1;   -- not logged: value unchanged
UPDATE employees SET salary = 160000 WHERE emp_id = 2;   -- logged: 150000 -> 160000
```

Use `IS DISTINCT FROM` rather than `<>` so a change to or from NULL is caught.

### 6.6 Statement-level triggers with transition tables

A row trigger on a 100,000-row update runs 100,000 times. A statement trigger with `REFERENCING` runs once and sees every changed row as a table. Transition tables work only on AFTER triggers.

```sql
CREATE OR REPLACE FUNCTION summarize_raises()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_rows  int;
    v_delta numeric;
BEGIN
    SELECT count(*), sum(n.salary - o.salary)
    INTO   v_rows, v_delta
    FROM   old_rows o JOIN new_rows n USING (emp_id);
    RAISE NOTICE '% employees updated, payroll changed by %', v_rows, v_delta;
    RETURN NULL;
END $$;

CREATE TRIGGER employees_raise_summary
    AFTER UPDATE ON employees
    REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION summarize_raises();

UPDATE employees SET salary = salary * 1.05 WHERE dept_id = 2;
-- NOTICE:  2 employees updated, payroll changed by 9150.00
```

### 6.7 INSTEAD OF triggers: making a view writable

A view built on a join cannot be inserted into directly. An INSTEAD OF trigger tells PostgreSQL what to do instead.

```sql
CREATE VIEW employee_directory AS
SELECT e.emp_id, e.name, e.email, d.name AS department
FROM employees e JOIN departments d USING (dept_id);

CREATE OR REPLACE FUNCTION employee_directory_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_dept int;
BEGIN
    SELECT dept_id INTO v_dept FROM departments WHERE name = NEW.department;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown department: %', NEW.department;
    END IF;

    INSERT INTO employees (name, email, dept_id, salary)
    VALUES (NEW.name, NEW.email, v_dept, 50000)      -- default starting salary
    RETURNING emp_id INTO NEW.emp_id;

    RETURN NEW;            -- lets INSERT ... RETURNING show the new id
END $$;

CREATE TRIGGER employee_directory_ins
    INSTEAD OF INSERT ON employee_directory
    FOR EACH ROW EXECUTE FUNCTION employee_directory_insert();

INSERT INTO employee_directory (name, email, department)
VALUES ('Omar Farooq', 'omar@corp.pk', 'Sales')
RETURNING *;
```

The insert also passes through `employees_validate` and `employees_audit`, because the trigger performs a real insert on `employees`.

## 7. Managing and debugging triggers

### 7.1 Everyday commands

```sql
-- list your triggers
SELECT tgname, tgrelid::regclass AS table_name, tgenabled
FROM   pg_trigger
WHERE  NOT tgisinternal          -- hide the ones behind foreign keys
ORDER  BY 2, 1;

-- the same, SQL-standard view (one row per event)
SELECT trigger_name, event_manipulation, action_timing, action_orientation
FROM   information_schema.triggers
WHERE  event_object_table = 'orders';

-- in psql: \d employees  shows the triggers under the table

-- see a trigger's full definition
SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = 'employees_audit';

-- switch off / on (e.g. during a bulk load)
ALTER TABLE employees DISABLE TRIGGER employees_audit;
ALTER TABLE employees ENABLE  TRIGGER employees_audit;
ALTER TABLE employees DISABLE TRIGGER USER;   -- all user triggers on the table

-- remove
DROP TRIGGER IF EXISTS employees_audit ON employees;
DROP FUNCTION IF EXISTS audit_changes();       -- only after all its triggers are gone

-- PostgreSQL 14+: replace a trigger in place
CREATE OR REPLACE TRIGGER employees_audit ...;
```

### 7.2 Debugging tips

- Sprinkle `RAISE NOTICE` with `TG_NAME`, `TG_OP` and `NEW`/`OLD`, as in 5.5. Remove it or drop to `RAISE DEBUG` when done.
- `pg_trigger_depth()` returns 0 at the top level, 1 inside a trigger, 2 inside a trigger fired by a trigger, and so on.
- Test inside `BEGIN; … ROLLBACK;` so mistakes do not stick.
- An error message's `CONTEXT:` line names the function and line number where it happened.

### 7.3 Common pitfalls

| Pitfall | What happens | Fix |
| --- | --- | --- |
| BEFORE ROW function returns `NULL` by accident (e.g. falls through to `RETURN NULL`) | The row is silently skipped; no error | Return `NEW` (or `OLD` for DELETE) |
| Changing `NEW` in an AFTER trigger | No effect: the row is already written | Do it in a BEFORE trigger |
| A trigger that updates its own table | Fires itself again, up to stack overflow | Use a BEFORE trigger to change `NEW`, or guard with `WHEN (pg_trigger_depth() < 1)` |
| Heavy logic in a row trigger | Bulk statements become slow | Statement trigger with transition tables (6.6) |
| Relying on trigger order | Order is alphabetical by name, easy to break | Merge the logic, or name triggers with a prefix such as `a_`, `b_` |
| Expecting triggers on `TRUNCATE` per row | Only statement-level TRUNCATE triggers exist | Use `ON TRUNCATE … FOR EACH STATEMENT` |
| Forgetting `RETURNS trigger` | `CREATE TRIGGER` fails | Trigger functions take no arguments and return `trigger` |
| Logic hidden in triggers | Others cannot see why data changes | Name triggers clearly and document them with `COMMENT ON TRIGGER` |

A recursion guard in practice:

```sql
CREATE TRIGGER t_bump AFTER UPDATE ON t
    FOR EACH ROW
    WHEN (pg_trigger_depth() < 1)      -- only when fired by a user statement
    EXECUTE FUNCTION bump();
```

## 8. Practice activities

Start each activity from a fresh copy of the Section 1 data (drop and re-create the tables) so the expected results match. Difficulty: ★ easy, ★★ medium, ★★★ challenge. Tick each one off as you finish.

### Part A: Cursors

- [ ] **A1 ★ Department head-count.** Write a `DO` block that loops over every department (alphabetically) and prints how many employees it has. Print `no employees!` for an empty department. *Expected:* `Engineering: 2`, `HR: 1`, `Sales: 2`.
- [ ] **A2 ★ Early exit.** Using an explicit cursor (`OPEN` / `FETCH` / `CLOSE`), walk through employees in order of `hired_on` and keep a running total of salaries. Stop as soon as the total passes 300,000 and print who pushed it over. *Expected:* Ayesha Khan, running total 345,000.
- [ ] **A3 ★★ Paging through a returned cursor.** Write a function `top_earners(p_n int, p_cur refcursor DEFAULT 'top_cur')` that returns a cursor over the top `p_n` earners with their department name. In one transaction, call it with 4, then fetch the rows two at a time.
- [ ] **A4 ★★ WHERE CURRENT OF.** Using a cursor declared `FOR UPDATE`, mark every `pending` order over 10,000 as `priority` and print how many you changed. *Expected:* 1 order (order 2).
- [ ] **A5 ★★ Set-based rewrite.** Rewrite A4 as a single `UPDATE` statement. In a sentence, explain why it is faster.

### Part B: Triggers

- [ ] **B1 ★ Clean incoming orders.** BEFORE INSERT on `orders`: trim the customer name, collapse repeated spaces and capitalise each word; reject an amount that is NULL or ≤ 0. *Test:* `'  zeta  enterprises '` should be stored as `Zeta Enterprises`.
- [ ] **B2 ★ Protect shipped orders.** Make it impossible to delete an order whose status is `shipped`. Deleting a `cancelled` order must still work. Use a `WHEN` clause.
- [ ] **B3 ★★ Status workflow.** Only these status changes are allowed: `pending → shipped`, `pending → cancelled`, `shipped → delivered`. Any other change raises an error that names the order and both statuses.
- [ ] **B4 ★★ Budget guard.** Prevent any INSERT or UPDATE on `employees` that would push a department's total salary over its `budget`. *Test:* adding a 60,000 hire to HR fails (70,000 + 60,000 > 120,000); a 40,000 hire succeeds.
- [ ] **B5 ★★★ Daily sales roll-up.** Create `daily_sales(sale_date, order_count, total)`. Write a statement-level AFTER INSERT trigger on `orders` that uses a transition table to add each statement's orders to the right day (hint: `INSERT … ON CONFLICT DO UPDATE`). A 3-row insert must fire the function once, not three times.

### Part C: Mini-project (cursor + trigger)

- [ ] **C1 ★★★ Consistency checker.** Install the `orders_total_sales` trigger from 6.4 (skip the backfill). Then write a procedure `check_total_sales(p_fix boolean DEFAULT false)` that uses a cursor to compare each employee's stored `total_sales` with the real sum of shipped orders. It prints every mismatch and, when `p_fix` is true, corrects it. Run it three times: check, fix, check again. *Expected:* 2 mismatches, then fixed, then 0.

### Stretch ideas

- Add an `updated_by` column filled from `current_user` by a BEFORE trigger.
- Turn the audit trigger from 6.3 into one that stores only the columns that changed (hint: compare `to_jsonb(OLD)` and `to_jsonb(NEW)` key by key with `jsonb_each`).
- Write an INSTEAD OF UPDATE and INSTEAD OF DELETE trigger for `employee_directory` from 6.7.

## 9. Solutions

Try each activity before reading its solution. Every solution below was run on PostgreSQL 16 against the Section 1 data.

### A1 — Department head-count

```sql
DO $$
DECLARE
    d     record;
    v_cnt int;
BEGIN
    FOR d IN SELECT dept_id, name FROM departments ORDER BY name LOOP
        SELECT count(*) INTO v_cnt FROM employees WHERE dept_id = d.dept_id;
        IF v_cnt = 0 THEN
            RAISE NOTICE '%: no employees!', d.name;
        ELSE
            RAISE NOTICE '%: % employee(s)', d.name, v_cnt;
        END IF;
    END LOOP;
END $$;
```

### A2 — Early exit

```sql
DO $$
DECLARE
    c CURSOR FOR SELECT name, salary, hired_on FROM employees ORDER BY hired_on;
    r         record;
    v_running numeric := 0;
BEGIN
    OPEN c;
    LOOP
        FETCH c INTO r;
        EXIT WHEN NOT FOUND;
        v_running := v_running + r.salary;
        IF v_running > 300000 THEN
            RAISE NOTICE 'Threshold crossed by % (hired %), running total %',
                r.name, r.hired_on, v_running;
            EXIT;                       -- stop reading; no need for the rest
        END IF;
    END LOOP;
    CLOSE c;
END $$;
-- NOTICE:  Threshold crossed by Ayesha Khan (hired 2021-03-15), running total 345000.00
```

### A3 — Paging through a returned cursor

```sql
CREATE OR REPLACE FUNCTION top_earners(p_n int, p_cur refcursor DEFAULT 'top_cur')
RETURNS refcursor LANGUAGE plpgsql AS $$
BEGIN
    OPEN p_cur FOR
        SELECT e.name, d.name AS department, e.salary
        FROM employees e JOIN departments d USING (dept_id)
        ORDER BY e.salary DESC
        LIMIT p_n;
    RETURN p_cur;
END $$;

BEGIN;
SELECT top_earners(4);
FETCH 2 FROM top_cur;    -- Ayesha Khan, Bilal Ahmed
FETCH 2 FROM top_cur;    -- Sana Malik, Usman Tariq
COMMIT;
```

### A4 — WHERE CURRENT OF

```sql
DO $$
DECLARE
    c CURSOR FOR
        SELECT order_id, amount FROM orders WHERE status = 'pending' FOR UPDATE;
    v_count int := 0;
BEGIN
    FOR r IN c LOOP
        IF r.amount > 10000 THEN
            UPDATE orders SET status = 'priority' WHERE CURRENT OF c;
            v_count := v_count + 1;
        END IF;
    END LOOP;
    RAISE NOTICE '% order(s) marked priority', v_count;
END $$;
```

### A5 — Set-based rewrite

```sql
UPDATE orders SET status = 'priority'
WHERE status = 'pending' AND amount > 10000;
```

It is faster because the database plans and runs one statement over the whole set, instead of switching between PL/pgSQL and the SQL engine once per row.

### B1 — Clean incoming orders

```sql
CREATE OR REPLACE FUNCTION orders_before_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.customer := initcap(regexp_replace(trim(NEW.customer), '\s+', ' ', 'g'));
    IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
        RAISE EXCEPTION 'Order amount must be positive (got %)', NEW.amount;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER orders_bi_clean
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION orders_before_insert();

INSERT INTO orders (emp_id, customer, amount)
VALUES (3, '  zeta  enterprises ', 7000)
RETURNING customer, status;          -- Zeta Enterprises | pending
```

### B2 — Protect shipped orders

```sql
CREATE OR REPLACE FUNCTION protect_shipped_orders()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Order % is shipped and cannot be deleted', OLD.order_id;
END $$;

CREATE TRIGGER orders_bd_protect
    BEFORE DELETE ON orders
    FOR EACH ROW
    WHEN (OLD.status = 'shipped')      -- function only runs for shipped rows
    EXECUTE FUNCTION protect_shipped_orders();

DELETE FROM orders WHERE order_id = 1;   -- ERROR: Order 1 is shipped ...
DELETE FROM orders WHERE order_id = 4;   -- works (cancelled)
```

### B3 — Status workflow

```sql
CREATE OR REPLACE FUNCTION check_order_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT (
           (OLD.status = 'pending' AND NEW.status IN ('shipped', 'cancelled'))
        OR (OLD.status = 'shipped' AND NEW.status = 'delivered')
    ) THEN
        RAISE EXCEPTION 'Invalid status change for order %: % -> %',
            OLD.order_id, OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER orders_bu_status
    BEFORE UPDATE OF status ON orders
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION check_order_status();

UPDATE orders SET status = 'shipped' WHERE order_id = 2;  -- OK
UPDATE orders SET status = 'pending' WHERE order_id = 2;  -- ERROR: shipped -> pending
```

### B4 — Budget guard

```sql
CREATE OR REPLACE FUNCTION check_dept_budget()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_total  numeric;
    v_budget numeric;
BEGIN
    SELECT budget INTO v_budget FROM departments WHERE dept_id = NEW.dept_id;

    -- everyone else in the department (excludes this row on UPDATE)
    SELECT COALESCE(sum(salary), 0) INTO v_total
    FROM employees
    WHERE dept_id = NEW.dept_id
      AND emp_id IS DISTINCT FROM NEW.emp_id;

    IF v_total + NEW.salary > v_budget THEN
        RAISE EXCEPTION 'Department % over budget: % + % > %',
            NEW.dept_id, v_total, NEW.salary, v_budget;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER employees_biu_budget
    BEFORE INSERT OR UPDATE OF salary, dept_id ON employees
    FOR EACH ROW EXECUTE FUNCTION check_dept_budget();

INSERT INTO employees (name, dept_id, salary) VALUES ('New Hire', 3, 60000);
-- ERROR:  Department 3 over budget: 70000.00 + 60000.00 > 120000.00
INSERT INTO employees (name, dept_id, salary) VALUES ('New Hire', 3, 40000);  -- OK
```

Note: two sessions inserting at the same moment could each pass the check. In production, lock the department row first with `SELECT … FROM departments WHERE dept_id = NEW.dept_id FOR UPDATE`.

### B5 — Daily sales roll-up

```sql
CREATE TABLE daily_sales (
    sale_date   date PRIMARY KEY,
    order_count int NOT NULL,
    total       numeric(12,2) NOT NULL
);

CREATE OR REPLACE FUNCTION roll_up_daily_sales()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO daily_sales AS ds (sale_date, order_count, total)
    SELECT created_at::date, count(*), sum(amount)
    FROM   new_orders
    GROUP  BY created_at::date
    ON CONFLICT (sale_date) DO UPDATE
        SET order_count = ds.order_count + EXCLUDED.order_count,
            total       = ds.total + EXCLUDED.total;
    RETURN NULL;
END $$;

CREATE TRIGGER orders_ai_daily
    AFTER INSERT ON orders
    REFERENCING NEW TABLE AS new_orders
    FOR EACH STATEMENT EXECUTE FUNCTION roll_up_daily_sales();

INSERT INTO orders (emp_id, customer, amount) VALUES
  (3, 'Eta Co', 1000), (4, 'Theta Co', 2000), (4, 'Iota Co', 3000);
INSERT INTO orders (emp_id, customer, amount) VALUES (3, 'Kappa Co', 500);

SELECT * FROM daily_sales;   -- today | 4 | 6500.00
```

### C1 — Consistency checker

```sql
-- (install maintain_total_sales() and orders_total_sales from 6.4 first)

CREATE OR REPLACE PROCEDURE check_total_sales(p_fix boolean DEFAULT false)
LANGUAGE plpgsql AS $$
DECLARE
    c CURSOR FOR
        SELECT e.emp_id, e.name, e.total_sales AS stored,
               COALESCE(sum(o.amount) FILTER (WHERE o.status = 'shipped'), 0) AS actual
        FROM employees e LEFT JOIN orders o USING (emp_id)
        GROUP BY e.emp_id
        ORDER BY e.emp_id;
    v_bad int := 0;
BEGIN
    FOR r IN c LOOP
        IF r.stored <> r.actual THEN
            v_bad := v_bad + 1;
            RAISE NOTICE 'Mismatch for %: stored %, actual %', r.name, r.stored, r.actual;
            IF p_fix THEN
                UPDATE employees SET total_sales = r.actual WHERE emp_id = r.emp_id;
            END IF;
        END IF;
    END LOOP;
    RAISE NOTICE '% mismatch(es) found%', v_bad,
        CASE WHEN p_fix AND v_bad > 0 THEN ' and fixed' ELSE '' END;
END $$;

CALL check_total_sales();        -- 2 mismatch(es) found
CALL check_total_sales(true);    -- 2 mismatch(es) found and fixed
CALL check_total_sales();        -- 0 mismatch(es) found
```

From here on the trigger keeps the totals right, and the procedure is a cheap nightly safety net.

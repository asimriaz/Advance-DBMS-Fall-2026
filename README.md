## **Cursors and Triggers in PL/pgSQL**

This tutorial covers **cursors and triggers in PostgreSQL 18 PL/pgSQL**, with runnable examples, expected results, and classroom practice activities. Run the setup once, then work through the examples in order.

**1. Create the practice database objects**

Use a separate schema so these examples remain separate from your other employee tables:

```sql
CREATE SCHEMA cursor_trigger_lab;

CREATE TABLE cursor_trigger_lab.employees (
    employee_id integer PRIMARY KEY,
    full_name text NOT NULL,
    department text NOT NULL,
    salary numeric(10,2) NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cursor_trigger_lab.employees
    (employee_id, full_name, department, salary)
VALUES
    (1, 'Ayesha Khan', 'IT', 85000),
    (2, 'Bilal Ahmed', 'IT', 62000),
    (3, 'Sara Ali', 'HR', 70000),
    (4, 'Hamza Noor', 'HR', 95000);
```

Check the data:

```sql
SELECT employee_id, full_name, department, salary
FROM cursor_trigger_lab.employees
ORDER BY employee_id;
```

| employee_id | full_name | department | salary |
|---:|---|---|---:|
| 1 | Ayesha Khan | IT | 85000.00 |
| 2 | Bilal Ahmed | IT | 62000.00 |
| 3 | Sara Ali | HR | 70000.00 |
| 4 | Hamza Noor | HR | 95000.00 |

The examples use fully qualified table names, such as `cursor_trigger_lab.employees`, so they work without changing your search path.

---

**2. What is a Cursor?**

A cursor gives you a position within a query result so you can retrieve and process rows gradually. In PL/pgSQL, cursor variables have the type `refcursor`. [PostgreSQL Docs: PL/pgSQL Cursors](https://www.postgresql.org/docs/18/plpgsql-cursors.html)

For example, a query returns four employees. A cursor lets your code fetch Ayesha, process her row, then fetch Bilal, and continue.

Use a cursor when the task needs row-by-row processing. For ordinary filtering, aggregation, or bulk updates, a single SQL statement is usually clearer.

The explicit cursor lifecycle is:

| Step | Command | Purpose |
|---|---|---|
| Define | `CURSOR FOR SELECT ...` | Specify the query |
| Open | `OPEN` | Make the cursor available |
| Retrieve | `FETCH ... INTO` | Copy a row into variables |
| Process | PL/pgSQL statements | Work with that row |
| Close | `CLOSE` | Release the cursor |

**3. Example: display every employee using an explicit cursor**

```sql
DO $$
DECLARE
    c_employees CURSOR FOR
        SELECT employee_id, full_name, salary
        FROM cursor_trigger_lab.employees
        ORDER BY employee_id;

    v_employee record;
BEGIN
    OPEN c_employees;

    LOOP
        FETCH c_employees INTO v_employee;

        EXIT WHEN NOT FOUND;

        RAISE NOTICE 'ID: %, Name: %, Salary: %',
            v_employee.employee_id,
            v_employee.full_name,
            v_employee.salary;
    END LOOP;

    CLOSE c_employees;
END;
$$ LANGUAGE plpgsql;
```

Expected messages:

```text
NOTICE: ID: 1, Name: Ayesha Khan, Salary: 85000.00
NOTICE: ID: 2, Name: Bilal Ahmed, Salary: 62000.00
NOTICE: ID: 3, Name: Sara Ali, Salary: 70000.00
NOTICE: ID: 4, Name: Hamza Noor, Salary: 95000.00
```

`record` can hold the columns returned by the query. Each `FETCH` replaces its contents with the next row.

Check `FOUND` immediately after `FETCH`: it becomes false when no row is retrieved. Placing `EXIT WHEN NOT FOUND` before processing prevents the loop from processing an empty fetch. [PostgreSQL Docs: Using Cursors (FETCH and FOUND)](https://www.postgresql.org/docs/18/plpgsql-cursors.html)

**4. Example: use a cursor `FOR` loop**

A cursor `FOR` loop handles opening, fetching, and closing automatically. Its loop record is also created automatically. [PostgreSQL Docs: Looping Through a Cursor's Result](https://www.postgresql.org/docs/18/plpgsql-cursors.html)

```sql
DO $$
DECLARE
    c_employees CURSOR FOR
        SELECT full_name, department
        FROM cursor_trigger_lab.employees
        ORDER BY employee_id;
BEGIN
    FOR v_employee IN c_employees LOOP
        RAISE NOTICE '% works in %',
            v_employee.full_name,
            v_employee.department;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

Expected messages:

```text
NOTICE: Ayesha Khan works in IT
NOTICE: Bilal Ahmed works in IT
NOTICE: Sara Ali works in HR
NOTICE: Hamza Noor works in HR
```

For a straightforward loop, you can also write a query directly:

```sql
DO $$
DECLARE
    v_employee record;
BEGIN
    FOR v_employee IN
        SELECT full_name, salary
        FROM cursor_trigger_lab.employees
        ORDER BY employee_id
    LOOP
        RAISE NOTICE '% earns %',
            v_employee.full_name,
            v_employee.salary;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

This query `FOR` loop uses a cursor internally, without an explicit cursor declaration. [PostgreSQL Docs: Looping Through Query Results](https://www.postgresql.org/docs/18/plpgsql-control-structures.html)

**5. Example: parameterized cursor**

A parameter lets the same cursor query process different departments.

```sql
DO $$
DECLARE
    c_department CURSOR (p_department text) FOR
        SELECT full_name, salary
        FROM cursor_trigger_lab.employees
        WHERE department = p_department
        ORDER BY employee_id;

    v_employee record;
BEGIN
    OPEN c_department('HR');

    LOOP
        FETCH c_department INTO v_employee;
        EXIT WHEN NOT FOUND;

        RAISE NOTICE '% earns %',
            v_employee.full_name,
            v_employee.salary;
    END LOOP;

    CLOSE c_department;
END;
$$ LANGUAGE plpgsql;
```

Expected messages:

```text
NOTICE: Sara Ali earns 70000.00
NOTICE: Hamza Noor earns 95000.00
```

Change `'HR'` to `'IT'` to process the IT employees.

**6. Example: navigate with a scrollable cursor**

Declare `SCROLL` when you need backward navigation. `FIRST`, `LAST`, `PRIOR`, and `ABSOLUTE` select particular positions. [PostgreSQL Docs: FETCH (Scrollable Cursors)](https://www.postgresql.org/docs/18/sql-fetch.html)

```sql
DO $$
DECLARE
    c_employees SCROLL CURSOR FOR
        SELECT employee_id, full_name
        FROM cursor_trigger_lab.employees
        ORDER BY employee_id;

    v_employee record;
BEGIN
    OPEN c_employees;

    FETCH FIRST FROM c_employees INTO v_employee;
    RAISE NOTICE 'First: %', v_employee.full_name;

    FETCH LAST FROM c_employees INTO v_employee;
    RAISE NOTICE 'Last: %', v_employee.full_name;

    FETCH PRIOR FROM c_employees INTO v_employee;
    RAISE NOTICE 'Previous: %', v_employee.full_name;

    FETCH ABSOLUTE 2 FROM c_employees INTO v_employee;
    RAISE NOTICE 'Second: %', v_employee.full_name;

    CLOSE c_employees;
END;
$$ LANGUAGE plpgsql;
```

Expected messages:

```text
NOTICE: First: Ayesha Khan
NOTICE: Last: Hamza Noor
NOTICE: Previous: Sara Ali
NOTICE: Second: Bilal Ahmed
```

Here, “second” means the second row in the ordered query result, rather than necessarily employee ID `2`.

**7. Example: update the current cursor row**

`WHERE CURRENT OF` identifies the row on which the cursor is currently positioned. Use a suitable single-table query with `FOR UPDATE`. A cursor declared with `FOR UPDATE` cannot also use `SCROLL`. [PostgreSQL Docs: UPDATE/DELETE WHERE CURRENT OF](https://www.postgresql.org/docs/18/plpgsql-cursors.html)

This example gives employees earning below `70000` an increase of `5000`. The outer transaction lets you inspect and then undo the change:

```sql
BEGIN;

DO $$
DECLARE
    c_low_salary CURSOR FOR
        SELECT employee_id, full_name, salary
        FROM cursor_trigger_lab.employees
        WHERE salary < 70000
        ORDER BY employee_id
        FOR UPDATE;

    v_employee record;
BEGIN
    OPEN c_low_salary;

    LOOP
        FETCH c_low_salary INTO v_employee;
        EXIT WHEN NOT FOUND;

        UPDATE cursor_trigger_lab.employees
        SET salary = salary + 5000
        WHERE CURRENT OF c_low_salary;

        RAISE NOTICE 'Updated employee: %',
            v_employee.full_name;
    END LOOP;

    CLOSE c_low_salary;
END;
$$ LANGUAGE plpgsql;

SELECT full_name, salary
FROM cursor_trigger_lab.employees
WHERE employee_id = 2;

ROLLBACK;
```

Before the rollback, Bilal’s salary is `67000.00`. Afterward, it returns to `62000.00`.

For this particular task, the simpler equivalent is:

```sql
UPDATE cursor_trigger_lab.employees
SET salary = salary + 5000
WHERE salary < 70000;
```

The cursor version is useful for learning how current-row updates work.

**8. Example: return a cursor from a function**

A function can open a cursor and return its name. The caller then fetches rows in the **same session and transaction**. These PL/pgSQL cursors close when the transaction ends. [PostgreSQL Docs: DECLARE (Cursor Lifetime)](https://www.postgresql.org/docs/18/sql-declare.html)

```sql
CREATE OR REPLACE FUNCTION cursor_trigger_lab.open_department_cursor(
    p_department text,
    p_cursor refcursor
)
RETURNS refcursor
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_cursor FOR
        SELECT employee_id, full_name, salary
        FROM cursor_trigger_lab.employees
        WHERE department = p_department
        ORDER BY employee_id;

    RETURN p_cursor;
END;
$$;
```

Run:

```sql
BEGIN;

SELECT cursor_trigger_lab.open_department_cursor(
    'IT',
    'it_employee_cursor'
);

FETCH NEXT FROM it_employee_cursor;

FETCH ALL FROM it_employee_cursor;

COMMIT;
```

The first `FETCH` returns Ayesha. `FETCH ALL` returns the **remaining** row, Bilal.

These standalone SQL `FETCH` commands display query rows. Inside PL/pgSQL, `FETCH ... INTO` assigns one row to variables. [PostgreSQL Docs: FETCH Command](https://www.postgresql.org/docs/18/sql-fetch.html)

---

**9. What is a trigger?**

A trigger runs automatically in response to a specified table event. You create a trigger function, then attach it to a table with `CREATE TRIGGER`. [PostgreSQL Docs: CREATE TRIGGER](https://www.postgresql.org/docs/18/sql-createtrigger.html)

Typical uses include validating incoming data, filling timestamps, recording changes, and protecting particular rows.

| Timing | Typical purpose |
|---|---|
| `BEFORE` | Validate or modify an incoming row |
| `AFTER` | Record an operation after it occurs |
| `INSTEAD OF` | Implement writes through a view |

A row trigger runs for each affected row. A statement trigger runs once for the statement—even if it affects zero rows. [PostgreSQL Docs: Row vs. Statement Triggers](https://www.postgresql.org/docs/18/trigger-definition.html)

**10. Understand `NEW`, `OLD`, and trigger return values**

For row triggers:

| Event | `OLD` | `NEW` |
|---|---|---|
| `INSERT` | Unavailable | Incoming row |
| `UPDATE` | Previous row | Updated row |
| `DELETE` | Deleted row | Unavailable |

Useful trigger variables include `TG_OP` for the operation and `TG_TABLE_NAME` for the table.

A `BEFORE INSERT/UPDATE` row trigger normally returns `NEW`; a `BEFORE DELETE` row trigger normally returns `OLD`. Returning `NULL` from a `BEFORE` row trigger skips that row’s operation. For `AFTER` and statement triggers, the return value is ignored. [PostgreSQL Docs: Trigger Functions and Return Values](https://www.postgresql.org/docs/18/plpgsql-trigger.html)

**11. Example: reject negative salaries**

```sql
CREATE OR REPLACE FUNCTION cursor_trigger_lab.validate_salary()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.salary < 0 THEN
        RAISE EXCEPTION 'Salary cannot be negative';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_salary
BEFORE INSERT OR UPDATE OF salary
ON cursor_trigger_lab.employees
FOR EACH ROW
EXECUTE FUNCTION cursor_trigger_lab.validate_salary();
```

Test this as a separate statement:

```sql
INSERT INTO cursor_trigger_lab.employees
    (employee_id, full_name, department, salary)
VALUES
    (5, 'Zain Ali', 'IT', -1000);
```

Expected result:

```text
ERROR: Salary cannot be negative
```

The row is not inserted.

For a simple rule such as nonnegative salary, a `CHECK (salary >= 0)` constraint would normally be preferable. This trigger demonstrates validation with PL/pgSQL.

Run intentional error tests individually with autocommit enabled. If you run one inside an explicit transaction, issue `ROLLBACK` after the error before continuing.

**12. Example: automatically set an update timestamp**

A `BEFORE` trigger can change `NEW` before PostgreSQL stores the row.

```sql
CREATE OR REPLACE FUNCTION cursor_trigger_lab.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_updated_at
BEFORE UPDATE
ON cursor_trigger_lab.employees
FOR EACH ROW
EXECUTE FUNCTION cursor_trigger_lab.set_updated_at();
```

Test and undo:

```sql
BEGIN;

UPDATE cursor_trigger_lab.employees
SET department = 'Finance'
WHERE employee_id = 3;

SELECT full_name, department, updated_at
FROM cursor_trigger_lab.employees
WHERE employee_id = 3;

ROLLBACK;
```

Sara’s department temporarily becomes `Finance`, and `updated_at` receives the current clock time.

Modify `NEW` directly for this task. Issuing another `UPDATE` on the same row from its update trigger can cause recursive trigger calls.

**13. Example: audit salary changes**

Create an audit table:

```sql
CREATE TABLE cursor_trigger_lab.salary_audit (
    audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id integer NOT NULL,
    old_salary numeric(10,2) NOT NULL,
    new_salary numeric(10,2) NOT NULL,
    changed_by text NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
```

Create the trigger function and trigger:

```sql
CREATE OR REPLACE FUNCTION cursor_trigger_lab.audit_salary_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO cursor_trigger_lab.salary_audit (
        employee_id,
        old_salary,
        new_salary,
        changed_by
    )
    VALUES (
        NEW.employee_id,
        OLD.salary,
        NEW.salary,
        CURRENT_USER
    );

    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_salary_change
AFTER UPDATE OF salary
ON cursor_trigger_lab.employees
FOR EACH ROW
WHEN (OLD.salary IS DISTINCT FROM NEW.salary)
EXECUTE FUNCTION cursor_trigger_lab.audit_salary_change();
```

The `WHEN` condition prevents an audit entry when the salary value remains unchanged. `UPDATE OF salary` means the column was named in the update; it does not by itself prove that its value changed. [PostgreSQL Docs: CREATE TRIGGER (WHEN Condition)](https://www.postgresql.org/docs/18/sql-createtrigger.html)

Test:

```sql
BEGIN;

UPDATE cursor_trigger_lab.employees
SET salary = 90000
WHERE employee_id = 1;

SELECT employee_id, old_salary, new_salary
FROM cursor_trigger_lab.salary_audit
ORDER BY audit_id;

ROLLBACK;
```

Expected audit row:

| employee_id | old_salary | new_salary |
|---:|---:|---:|
| 1 | 85000.00 | 90000.00 |

The salary update and audit insert belong to the same transaction. `ROLLBACK` undoes both. An `AFTER` trigger runs before transaction commit; it does not independently commit its audit record. [PostgreSQL Docs: Trigger Behavior and Transactions](https://www.postgresql.org/docs/18/trigger-definition.html)

**14. Example: protect HR employees from deletion**

```sql
CREATE OR REPLACE FUNCTION cursor_trigger_lab.protect_hr_employee()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.department = 'HR' THEN
        RAISE EXCEPTION 'Cannot delete HR employee: %',
            OLD.full_name;
    END IF;

    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_protect_hr_employee
BEFORE DELETE
ON cursor_trigger_lab.employees
FOR EACH ROW
EXECUTE FUNCTION cursor_trigger_lab.protect_hr_employee();
```

Test separately:

```sql
DELETE FROM cursor_trigger_lab.employees
WHERE employee_id = 3;
```

Expected result:

```text
ERROR: Cannot delete HR employee: Sara Ali
```

Sara remains in the table.

**15. Example: statement-level trigger**

```sql
CREATE OR REPLACE FUNCTION cursor_trigger_lab.report_update_statement()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE '% statement completed on %',
        TG_OP,
        TG_TABLE_NAME;

    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_report_update_statement
AFTER UPDATE
ON cursor_trigger_lab.employees
FOR EACH STATEMENT
EXECUTE FUNCTION cursor_trigger_lab.report_update_statement();
```

Test:

```sql
BEGIN;

UPDATE cursor_trigger_lab.employees
SET salary = salary + 1000
WHERE department = 'IT';

ROLLBACK;
```

Two employees are updated, but the statement trigger prints **one** message:

```text
NOTICE: UPDATE statement completed on employees
```

The salary audit trigger, being row-level, creates two temporary audit entries before the rollback.

**16. Manage triggers**

Temporarily disable and re-enable one trigger:

```sql
ALTER TABLE cursor_trigger_lab.employees
DISABLE TRIGGER trg_report_update_statement;

ALTER TABLE cursor_trigger_lab.employees
ENABLE TRIGGER trg_report_update_statement;
```

These commands require suitable table privileges. [PostgreSQL Docs: ALTER TABLE (Enable/Disable Triggers)](https://www.postgresql.org/docs/18/sql-altertable.html)

List the schema’s triggers:

```sql
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_orientation
FROM information_schema.triggers
WHERE trigger_schema = 'cursor_trigger_lab'
ORDER BY trigger_name, event_manipulation;
```

A trigger handling several events can appear in several rows.

---

**17. Classroom practice activities**

Complete these after the examples. The original employee salaries remain available because the successful change demonstrations used `ROLLBACK`.

| Activity | Task | Expected result |
|---|---|---|
| 1: Salary report | Use an explicit cursor to display employees earning at least `80000` | Ayesha and Hamza |
| 2: Payroll total | Use a cursor to count employees and calculate total salary | Count `4`; total `312000.00` |
| 3: Department report | Use a parameterized cursor to report a department’s employees and total salary | IT total `147000.00`; HR total `165000.00` |
| 4: Name validation | Create a `BEFORE INSERT/UPDATE` trigger rejecting names containing only spaces | `'   '` is rejected |
| 5: Reduction protection | Create a trigger rejecting salary reductions greater than 20% | Ayesha: `68000` allowed; `67000` rejected |
| 6: Deleted-row archive | Create an `AFTER DELETE` trigger that copies employee details into an archive table | Deleting Bilal creates an archive row |
| 7: Combined activity | Use a cursor to increase IT salaries by 5%; inspect the salary audit | Ayesha `89250.00`; Bilal `65100.00`; two audit rows |

For activity 6, use an IT employee: the existing protection trigger prevents HR deletions.

For successful updates or deletes, test with:

```sql
BEGIN;

-- Your operation
-- SELECT statements to inspect results

ROLLBACK;
```

For expected errors, run the test separately. If an error occurs inside an explicit transaction, roll back that transaction.

**18. Selected solutions**

**Activity 2 — Calculate payroll using a cursor**

```sql
DO $$
DECLARE
    c_payroll CURSOR FOR
        SELECT salary
        FROM cursor_trigger_lab.employees
        ORDER BY employee_id;

    v_salary numeric;
    v_total numeric := 0;
    v_count integer := 0;
BEGIN
    OPEN c_payroll;

    LOOP
        FETCH c_payroll INTO v_salary;
        EXIT WHEN NOT FOUND;

        v_total := v_total + v_salary;
        v_count := v_count + 1;
    END LOOP;

    CLOSE c_payroll;

    RAISE NOTICE 'Employees: %, Total salary: %',
        v_count, v_total;
END;
$$ LANGUAGE plpgsql;
```

Expected message:

```text
NOTICE: Employees: 4, Total salary: 312000.00
```

Compare with SQL aggregation:

```sql
SELECT count(*) AS employee_count, sum(salary) AS total_salary
FROM cursor_trigger_lab.employees;
```

Both calculate the same result; the cursor version demonstrates accumulation inside a loop.

**Activity 4 — Reject blank names**

```sql
CREATE OR REPLACE FUNCTION cursor_trigger_lab.validate_employee_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.full_name IS NULL OR btrim(NEW.full_name) = '' THEN
        RAISE EXCEPTION 'Employee name cannot be blank';
    END IF;

    NEW.full_name := btrim(NEW.full_name);

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_employee_name
BEFORE INSERT OR UPDATE OF full_name
ON cursor_trigger_lab.employees
FOR EACH ROW
EXECUTE FUNCTION cursor_trigger_lab.validate_employee_name();
```

Test:

```sql
INSERT INTO cursor_trigger_lab.employees
    (employee_id, full_name, department, salary)
VALUES
    (5, '   ', 'IT', 50000);
```

Expected error: `Employee name cannot be blank`.

**Activity 5 — Reject reductions greater than 20%**

```sql
CREATE OR REPLACE FUNCTION cursor_trigger_lab.protect_salary_reduction()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.salary < OLD.salary * 0.80 THEN
        RAISE EXCEPTION
            'Salary reduction exceeds 20%%: old %, new %',
            OLD.salary,
            NEW.salary;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_salary_reduction
BEFORE UPDATE OF salary
ON cursor_trigger_lab.employees
FOR EACH ROW
EXECUTE FUNCTION cursor_trigger_lab.protect_salary_reduction();
```

`%%` prints a literal percent sign in a `RAISE` message.

Allowed test:

```sql
BEGIN;

UPDATE cursor_trigger_lab.employees
SET salary = 68000
WHERE employee_id = 1;

ROLLBACK;
```

Rejected test, run separately:

```sql
UPDATE cursor_trigger_lab.employees
SET salary = 67000
WHERE employee_id = 1;
```

**Activity 7 — Combine a cursor with auditing triggers**

```sql
BEGIN;

DO $$
DECLARE
    c_it CURSOR FOR
        SELECT employee_id, salary
        FROM cursor_trigger_lab.employees
        WHERE department = 'IT'
        ORDER BY employee_id
        FOR UPDATE;

    v_employee record;
BEGIN
    OPEN c_it;

    LOOP
        FETCH c_it INTO v_employee;
        EXIT WHEN NOT FOUND;

        UPDATE cursor_trigger_lab.employees
        SET salary = round(salary * 1.05, 2)
        WHERE CURRENT OF c_it;
    END LOOP;

    CLOSE c_it;
END;
$$ LANGUAGE plpgsql;

SELECT full_name, salary
FROM cursor_trigger_lab.employees
WHERE department = 'IT'
ORDER BY employee_id;

SELECT employee_id, old_salary, new_salary
FROM cursor_trigger_lab.salary_audit
ORDER BY audit_id;

ROLLBACK;
```

Expected audit data:

| employee_id | old_salary | new_salary |
|---:|---:|---:|
| 1 | 85000.00 | 89250.00 |
| 2 | 62000.00 | 65100.00 |

The cursor controls which row is updated. Each update automatically activates the validation, timestamp, and auditing triggers attached to the table.

**Common mistakes to check while practising**

| Mistake | Correction |
|---|---|
| Processing a row before checking whether `FETCH` succeeded | Put `EXIT WHEN NOT FOUND` immediately after `FETCH` |
| Fetching from a returned cursor after commit | Fetch within the transaction that opened it |
| Expecting a defined row order without `ORDER BY` | Add an explicit ordering |
| Using `NEW` in a delete trigger | Use `OLD` |
| Returning `NULL` from a `BEFORE UPDATE` trigger accidentally | Return `NEW` to allow the update |
| Expecting an `AFTER` audit row to survive rollback | Audit changes roll back with the triggering transaction |
| Calling a trigger function with ordinary `SELECT` | Test it through its configured table event |
| Updating the same table again merely to set `updated_at` | Assign `NEW.updated_at` in a `BEFORE` trigger |

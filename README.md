# Functions and Procedures

This tutorial uses one small `employees` table. Run the setup first, then run each example in order. The examples work in PostgreSQL 18 and use `PL/pgSQL`, PostgreSQL’s procedural language. :chatgpt-content-reference{index="0"}

## 1. Set up the practice data

Run this in a database where you can create a schema:

```sql
CREATE SCHEMA plpgsql_lesson;

SET search_path TO plpgsql_lesson, public;

CREATE TABLE employees (
    employee_id integer PRIMARY KEY,
    full_name text NOT NULL,
    department text NOT NULL,
    salary numeric(10,2) NOT NULL CHECK (salary >= 0)
);

INSERT INTO employees (employee_id, full_name, department, salary)
VALUES
    (1, 'Ayesha Khan', 'IT', 85000.00),
    (2, 'Bilal Ahmed', 'IT', 62000.00),
    (3, 'Sara Ali', 'HR', 70000.00);
```

Keep using the **same query session** so the `search_path` setting remains active. If you reconnect, run:

```sql
SET search_path TO plpgsql_lesson, public;
```

The examples that change salaries show how to restore the starting values before continuing.

## 2. Function versus procedure

| Feature | Function | Procedure |
|---|---|---|
| Create with | `CREATE FUNCTION` | `CREATE PROCEDURE` |
| Call with | Usually `SELECT` | `CALL` |
| Return | A value, a row, or a set of rows | No `RETURNS` clause; can expose `OUT` or `INOUT` values |
| Typical classroom example | Calculate annual salary | Give an employee a raise |
| Transaction control inside routine | Cannot `COMMIT` or `ROLLBACK` | Possible under specific calling rules |

A function can also change table data; the distinction is **not** that functions are read-only. Procedures are particularly useful when the operation is naturally an action and, when permitted, needs transaction control. :chatgpt-content-reference{index="1"}

---

# Part A — Functions

## 3. Anatomy of a function

```sql
CREATE OR REPLACE FUNCTION function_name(
    parameter_name parameter_type
)
RETURNS return_type
LANGUAGE plpgsql
AS $$
DECLARE
    -- Optional variables
BEGIN
    -- Statements
    RETURN value;
END;
$$;
```

- `CREATE OR REPLACE` lets you update a function while developing it.
- `DECLARE` is optional.
- `BEGIN` and `END` mark the PL/pgSQL code block. They **do not** start and commit a database transaction.
- `$$` surrounds the function body, so ordinary single quotes can appear inside it. :chatgpt-content-reference{index="2"}

### Example 1: Add two numbers

```sql
CREATE OR REPLACE FUNCTION add_numbers(
    p_first integer,
    p_second integer
)
RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN p_first + p_second;
END;
$$;

SELECT add_numbers(12, 8) AS result;
```

Expected result:

| result |
|---:|
| 20 |

The `p_` prefix is simply a naming convention for parameters; PostgreSQL does not require it.

### Example 2: Use a local variable

```sql
CREATE OR REPLACE FUNCTION calculate_discount(
    p_price numeric,
    p_discount_percent numeric
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    v_discount numeric;
    v_final_price numeric;
BEGIN
    v_discount := p_price * p_discount_percent / 100;
    v_final_price := p_price - v_discount;

    RETURN round(v_final_price, 2);
END;
$$;

SELECT calculate_discount(1000, 15) AS final_price;
```

Expected result: `850.00`.

Here, `:=` assigns a value to a PL/pgSQL variable. The `v_` prefix identifies a local variable.

## 4. Read a table value in a function

`SELECT ... INTO` assigns the result of a query to a PL/pgSQL variable. This differs from the standalone SQL command `SELECT INTO`, which creates a table. :chatgpt-content-reference{index="3"}

### Example 3: Calculate annual salary

```sql
CREATE OR REPLACE FUNCTION annual_salary(
    p_employee_id integer
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    v_monthly_salary numeric(10,2);
BEGIN
    SELECT e.salary
    INTO v_monthly_salary
    FROM employees AS e
    WHERE e.employee_id = p_employee_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % does not exist', p_employee_id;
    END IF;

    RETURN v_monthly_salary * 12;
END;
$$;

SELECT annual_salary(1) AS annual_salary;
```

Expected result: `1020000.00`.

**Follow the steps:** The query finds Ayesha’s monthly salary (`85000.00`), stores it in `v_monthly_salary`, and the function returns `85000 × 12`.

Try an unknown ID:

```sql
SELECT annual_salary(999);
```

Expected result:

```text
ERROR: Employee 999 does not exist
```

`FOUND` tells us whether the preceding `SELECT INTO` obtained a row.

## 5. Add conditions and validate input

### Example 4: Assign a salary band

```sql
CREATE OR REPLACE FUNCTION salary_band(
    p_salary numeric
)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_salary IS NULL THEN
        RETURN 'Unknown';
    ELSIF p_salary < 70000 THEN
        RETURN 'Junior';
    ELSIF p_salary < 85000 THEN
        RETURN 'Mid-level';
    ELSE
        RETURN 'Senior';
    END IF;
END;
$$;

SELECT
    full_name,
    salary,
    salary_band(salary) AS band
FROM employees
ORDER BY employee_id;
```

Expected result:

| full_name | salary | band |
|---|---:|---|
| Ayesha Khan | 85000.00 | Senior |
| Bilal Ahmed | 62000.00 | Junior |
| Sara Ali | 70000.00 | Mid-level |

In PL/pgSQL, write `ELSIF` for an additional condition. Notice the explicit `IS NULL` check: comparisons such as `NULL < 70000` do not evaluate to true. :chatgpt-content-reference{index="4"}

### Example 5: Reject invalid input

```sql
CREATE OR REPLACE FUNCTION calculate_bonus(
    p_salary numeric,
    p_percent numeric
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_salary IS NULL OR p_percent IS NULL THEN
        RAISE EXCEPTION 'Salary and percentage are required';
    END IF;

    IF p_salary < 0 OR p_percent < 0 THEN
        RAISE EXCEPTION 'Salary and percentage cannot be negative';
    END IF;

    RETURN round(p_salary * p_percent / 100, 2);
END;
$$;

SELECT calculate_bonus(70000, 10) AS bonus;
```

Expected result: `7000.00`.

`RAISE EXCEPTION` reports an error and stops the current operation. :chatgpt-content-reference{index="5"}

## 6. Return multiple rows

A function can return a table. Use `RETURN QUERY` to append the rows produced by a query to its result. :chatgpt-content-reference{index="6"}

### Example 6: List employees in a department

```sql
CREATE OR REPLACE FUNCTION employees_in_department(
    p_department text
)
RETURNS TABLE (
    employee_name text,
    monthly_salary numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT e.full_name, e.salary
    FROM employees AS e
    WHERE e.department = p_department
    ORDER BY e.employee_id;
END;
$$;

SELECT * FROM employees_in_department('IT');
```

Expected result:

| employee_name | monthly_salary |
|---|---:|
| Ayesha Khan | 85000.00 |
| Bilal Ahmed | 62000.00 |

Unlike a `DO` block that prints `RAISE NOTICE` messages, this function gives the caller ordinary query rows.

### Example 7: Return one calculated value for every employee

```sql
CREATE OR REPLACE FUNCTION employee_annual_salaries()
RETURNS TABLE (
    employee_name text,
    annual_amount numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.full_name,
        e.salary * 12
    FROM employees AS e
    ORDER BY e.employee_id;
END;
$$;

SELECT * FROM employee_annual_salaries();
```

**Student exercise:** Add a `p_department text` parameter so the function returns annual salaries for only one department.

## 7. Default and named arguments

### Example 8: Optional percentage

```sql
CREATE OR REPLACE FUNCTION projected_salary(
    p_salary numeric,
    p_raise_percent numeric DEFAULT 5
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN round(p_salary * (1 + p_raise_percent / 100), 2);
END;
$$;

SELECT projected_salary(70000) AS default_raise;
SELECT projected_salary(70000, 10) AS ten_percent_raise;

SELECT projected_salary(
    p_raise_percent => 8,
    p_salary => 70000
) AS named_arguments;
```

Expected results: `73500.00`, `77000.00`, and `75600.00`, respectively. The `=>` form names each argument, so their order can change.

---

# Part B — Procedures

## 8. Anatomy of a procedure

```sql
CREATE OR REPLACE PROCEDURE procedure_name(
    parameter_name parameter_type
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- Optional variables
BEGIN
    -- Statements
END;
$$;

CALL procedure_name(argument);
```

A procedure has no `RETURNS` clause. Call it with `CALL`, rather than putting it inside `SELECT`. :chatgpt-content-reference{index="7"}

## 9. Change table data with a procedure

### Example 9: Give one employee a raise

```sql
CREATE OR REPLACE PROCEDURE give_raise(
    p_employee_id integer,
    p_percent numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_rows_updated integer;
BEGIN
    IF p_percent IS NULL OR p_percent <= 0 THEN
        RAISE EXCEPTION 'Raise percentage must be greater than zero';
    END IF;

    UPDATE employees AS e
    SET salary = round(e.salary * (1 + p_percent / 100), 2)
    WHERE e.employee_id = p_employee_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN
        RAISE EXCEPTION 'Employee % does not exist', p_employee_id;
    END IF;
END;
$$;

CALL give_raise(2, 10);

SELECT employee_id, full_name, salary
FROM employees
WHERE employee_id = 2;
```

Expected result: Bilal’s salary changes from `62000.00` to `68200.00`.

`ROW_COUNT` reports how many rows the `UPDATE` affected. It lets us detect an employee ID that does not exist. **Calling this procedure again applies another 10% raise**, so restore Bilal’s salary before comparing later examples with the starting data:

```sql
UPDATE employees
SET salary = 62000.00
WHERE employee_id = 2;
```

### Example 10: Make a procedure report a value with `INOUT`

`INOUT` means a parameter supplies an initial value and receives a final value. When called as plain SQL, `CALL` displays its final value as a result row. :chatgpt-content-reference{index="8"}

```sql
CREATE OR REPLACE PROCEDURE apply_increase(
    INOUT p_amount numeric,
    IN p_percent numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_amount IS NULL OR p_percent IS NULL THEN
        RAISE EXCEPTION 'Amount and percentage are required';
    END IF;

    p_amount := round(p_amount * (1 + p_percent / 100), 2);
END;
$$;

CALL apply_increase(1000, 10);
```

Expected result:

| p_amount |
|---:|
| 1100.00 |

A PL/pgSQL block can also pass a variable to that procedure:

```sql
DO $$
DECLARE
    v_amount numeric := 1000;
BEGIN
    CALL apply_increase(v_amount, 10);
    RAISE NOTICE 'Updated amount: %', v_amount;
END;
$$;
```

Expected message: `NOTICE: Updated amount: 1100.00`. Within PL/pgSQL, an `OUT` or `INOUT` argument in `CALL` must correspond to a variable that receives the value. :chatgpt-content-reference{index="9"}

## 10. Transaction control: an important procedure rule

A procedure *can* execute `COMMIT` or `ROLLBACK`, but its `CALL` must meet PostgreSQL’s transaction rules. In particular, a procedure that commits must be invoked from the top level, outside an explicit `BEGIN ... COMMIT` transaction block. Functions cannot perform that transaction control. A PL/pgSQL `EXCEPTION` block also cannot end a transaction. :chatgpt-content-reference{index="10"}

Here is a small demonstration. Run the `CALL` **as its own statement with autocommit enabled**:

```sql
CREATE TABLE transaction_demo (
    entry_id integer PRIMARY KEY,
    note text NOT NULL
);

CREATE OR REPLACE PROCEDURE save_demo_entry(
    p_entry_id integer,
    p_note text
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO transaction_demo (entry_id, note)
    VALUES (p_entry_id, p_note);

    COMMIT;
END;
$$;

CALL save_demo_entry(1, 'Saved by a procedure');

SELECT * FROM transaction_demo;
```

The `SELECT` shows the saved row. This call would fail if you first issued `BEGIN` and then ran `CALL save_demo_entry(...)` inside that explicit transaction. You do **not** need a `COMMIT` inside ordinary procedures such as `give_raise`; the calling transaction can commit their changes normally.

---

# Common mistakes

| Mistake | Correct approach |
|---|---|
| `SELECT give_raise(2, 10);` | `CALL give_raise(2, 10);` |
| `CALL annual_salary(1);` | `SELECT annual_salary(1);` |
| Expecting a `DO` block to return query rows | Use a function with `RETURNS TABLE` and `RETURN QUERY` |
| Assuming a procedure cannot return any information | Use `OUT` or `INOUT` parameters when appropriate |
| Putting `COMMIT` in a function | Transaction control belongs to eligible procedure or `DO` calls |
| Writing `ELSE IF` for another condition | Use `ELSIF` |

# Practice activities

1. Create `employee_count(p_department text)` returning the number of employees in a department. Test it with `'IT'` and `'HR'`.
2. Create `monthly_tax(p_salary numeric, p_rate numeric)` that returns the tax amount. Reject rates below `0` or above `100`.
3. Create `move_employee(p_employee_id integer, p_new_department text)` as a procedure. Raise an exception if the employee does not exist.
4. Change `employees_in_department` so it accepts a minimum salary and returns only employees at or above that amount.

<details>
<summary>Solutions for activities 1 and 3</summary>

```sql
CREATE OR REPLACE FUNCTION employee_count(p_department text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    SELECT count(*)::integer
    INTO v_count
    FROM employees AS e
    WHERE e.department = p_department;

    RETURN v_count;
END;
$$;

SELECT employee_count('IT');  -- 2
SELECT employee_count('HR');  -- 1
```

```sql
CREATE OR REPLACE PROCEDURE move_employee(
    p_employee_id integer,
    p_new_department text
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_new_department IS NULL OR trim(p_new_department) = '' THEN
        RAISE EXCEPTION 'A department name is required';
    END IF;

    UPDATE employees AS e
    SET department = p_new_department
    WHERE e.employee_id = p_employee_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % does not exist', p_employee_id;
    END IF;
END;
$$;

CALL move_employee(3, 'IT');

SELECT full_name, department
FROM employees
WHERE employee_id = 3;
```

Sara’s department is now `IT`. To reset it:

```sql
UPDATE employees
SET department = 'HR'
WHERE employee_id = 3;
```

</details>

**Content Sequence:** 
Students run : 
Examples 1–2 to understand parameters and `RETURN`, 
Examples 3–6 to read and return table data, and 
Examples 9–10 to compare an action performed by `CALL` with a value returned by `SELECT`.

## Syntax Reading Guidelines
| Notation   | Meaning                         |
| ---------- | ------------------------------- |
| `COMMAND`  | Reserved Words                  |
| `command`  | User Defined                    |
| `< >`      | Compulsory                      |
| `[ ]`      | Optional value                  |
| `A \| B`   | Choose one required option      |
| `--option` | UNIX style argument             |
| `-o`       |  LINUX style argument           |

---

A `DO` block executes PL/pgSQL code once without creating a permanent function or procedure.

## Basic Structure

```sql
DO $$
DECLARE
    -- Variable declarations
BEGIN
    -- Executable statements
END;
$$ LANGUAGE plpgsql;
```

The `DECLARE` section is optional.

## 1. Display a Message

```sql
DO $$
BEGIN
    RAISE NOTICE 'Hello from PL/pgSQL';
END;
$$ LANGUAGE plpgsql;
```

## 2. Declare and display variables

### Common naming conventions

| Prefix | Meaning                         | Example         |
| ------ | ------------------------------- | --------------- |
| `v_`   | Local variable                  | `v_salary`      |
| `p_`   | Function or procedure parameter | `p_employee_id` |
| `c_`   | Cursor                          | `c_employees`   |
| `r_`   | Row or record variable          | `r_employee`    |
| `k_`   | Constant                        | `k_tax_rate`    |


```sql
DO $$
DECLARE
    v_name text := 'Asim';
    v_age integer := 25;
BEGIN
    RAISE NOTICE 'Name: %, Age: %', v_name, v_age;
END;
$$ LANGUAGE plpgsql;
```

Each `%` is replaced by the corresponding value.

## 3. Perform a calculation

```sql
DO $$
DECLARE
    v_number1 integer := 20;
    v_number2 integer := 10;
    v_result integer;
BEGIN
    v_result := v_number1 + v_number2;

    RAISE NOTICE 'Result: %', v_result;
END;
$$ LANGUAGE plpgsql;
```

## 4. Multiplication table

```sql
DO $$
DECLARE
    v_number integer := 2;
BEGIN
    FOR i IN 1..10 LOOP
        RAISE NOTICE '% x % = %',
            v_number,
            i,
            v_number * i;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

## 5. IF ELSE condition

```sql
DO $$
DECLARE
    v_marks integer := 75;
BEGIN
    IF v_marks >= 50 THEN
        RAISE NOTICE 'Student passed';
    ELSE
        RAISE NOTICE 'Student failed';
    END IF;
END;
$$ LANGUAGE plpgsql;
```

## 6. IF ELSIF ELSE

```sql
DO $$
DECLARE
    v_marks integer := 76;
    v_grade char(1);
BEGIN
    IF v_marks >= 85 THEN
        v_grade := 'A';
    ELSIF v_marks >= 70 THEN
        v_grade := 'B';
    ELSIF v_marks >= 60 THEN
        v_grade := 'C';
    ELSIF v_marks >= 50 THEN
        v_grade := 'D';
    ELSE
        v_grade := 'F';
    END IF;

    RAISE NOTICE 'Grade: %', v_grade;
END;
$$ LANGUAGE plpgsql;
```

In PL/pgSQL, write `ELSIF`, not `ELSE IF`.

## 7. CASE statement

```sql
DO $$
DECLARE
    v_day integer := 2;
    v_day_name text;
BEGIN
    CASE v_day
        WHEN 1 THEN
            v_day_name := 'Monday';
        WHEN 2 THEN
            v_day_name := 'Tuesday';
        WHEN 3 THEN
            v_day_name := 'Wednesday';
        ELSE
            v_day_name := 'Invalid day';
    END CASE;

    RAISE NOTICE 'Day: %', v_day_name;
END;
$$ LANGUAGE plpgsql;
```

## 8. FOR loop

```sql
DO $$
BEGIN
    FOR i IN 1..5 LOOP
        RAISE NOTICE 'Number: %', i;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

The loop variable `i` is created automatically.

## 9. Reverse FOR loop

```sql
DO $$
BEGIN
    FOR i IN REVERSE 5..1 LOOP
        RAISE NOTICE 'Number: %', i;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

Output goes from `5` to `1`.

## 10. WHILE loop

```sql
DO $$
DECLARE
    v_counter integer := 1;
BEGIN
    WHILE v_counter <= 5 LOOP
        RAISE NOTICE 'Counter: %', v_counter;

        v_counter := v_counter + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

## 11. LOOP with EXIT

```sql
DO $$
DECLARE
    v_counter integer := 1;
BEGIN
    LOOP
        RAISE NOTICE 'Counter: %', v_counter;

        v_counter := v_counter + 1;

        EXIT WHEN v_counter > 5;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

`LOOP` continues indefinitely unless it reaches `EXIT` or `RETURN`.

## 12. CONTINUE inside a loop

The following example skips even numbers:

```sql
DO $$
BEGIN
    FOR i IN 1..10 LOOP
        CONTINUE WHEN i % 2 = 0;

        RAISE NOTICE 'Odd number: %', i;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

## 13. SELECT INTO a variable

Suppose this table exists:

```sql
CREATE TABLE employees (
    employee_id integer PRIMARY KEY,
    full_name text,
    salary numeric(10,2)
);

INSERT INTO employees VALUES
    (1, 'Ayesha Khan', 85000),
    (2, 'Bilal Ahmed', 62000);
```

Load one row into variables:

```sql
DO $$
DECLARE
    v_name text;
    v_salary numeric(10,2);
BEGIN
    SELECT full_name, salary
    INTO v_name, v_salary
    FROM employees
    WHERE employee_id = 1;

    RAISE NOTICE '% earns %', v_name, v_salary;
END;
$$ LANGUAGE plpgsql;
```

Inside PL/pgSQL, `SELECT INTO` assigns query results to variables.

## 14. Check whether a row was found

```sql
DO $$
DECLARE
    v_employee employees%ROWTYPE;
BEGIN
    SELECT *
    INTO v_employee
    FROM employees
    WHERE employee_id = 999;

    IF FOUND THEN
        RAISE NOTICE 'Found: %', v_employee.full_name;
    ELSE
        RAISE NOTICE 'Employee not found';
    END IF;
END;
$$ LANGUAGE plpgsql;
```

`FOUND` becomes:

* `TRUE` when the query finds a row.
* `FALSE` when no row is found.

## 15. Process multiple table rows

```sql
DO $$
DECLARE
    v_employee record;
BEGIN
    FOR v_employee IN
        SELECT employee_id, full_name, salary
        FROM employees
        ORDER BY employee_id
    LOOP
        RAISE NOTICE 'ID: %, Name: %, Salary: %',
            v_employee.employee_id,
            v_employee.full_name,
            v_employee.salary;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

## 16. Insert data

```sql
DO $$
BEGIN
    INSERT INTO employees (
        employee_id,
        full_name,
        salary
    )
    VALUES (
        3,
        'Sara Ali',
        70000
    );

    RAISE NOTICE 'Employee inserted successfully';
END;
$$ LANGUAGE plpgsql;
```

## 17. Update and count affected rows

```sql
DO $$
DECLARE
    v_rows_updated integer;
BEGIN
    UPDATE employees
    SET salary = salary + 5000
    WHERE employee_id = 2;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    RAISE NOTICE 'Rows updated: %', v_rows_updated;
END;
$$ LANGUAGE plpgsql;
```

## 18. Handle an exception

```sql
DO $$
DECLARE
    v_result numeric;
BEGIN
    v_result := 10 / 0;

    RAISE NOTICE 'Result: %', v_result;
EXCEPTION
    WHEN division_by_zero THEN
        RAISE NOTICE 'Cannot divide by zero';
END;
$$ LANGUAGE plpgsql;
```

## 19. Raise a custom error

```sql
DO $$
DECLARE
    v_age integer := -5;
BEGIN
    IF v_age < 0 THEN
        RAISE EXCEPTION 'Age cannot be negative';
    END IF;

    RAISE NOTICE 'Valid age: %', v_age;
END;
$$ LANGUAGE plpgsql;
```

`RAISE EXCEPTION` stops the block and reports an error.

## Important limitation

A `DO` block cannot directly return query rows to the client. Use it for:

* Testing PL/pgSQL syntax
* Administrative scripts
* One-time data processing
* Variables and control structures
* Insert, update and delete operations

Use a function with `RETURNS TABLE` when you need clean rows returned by `SELECT`.

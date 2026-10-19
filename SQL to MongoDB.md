> For the complete MongoDB documentation index, see www.mongodb.com/docs/llms.txt

# SQL to MongoDB Mapping Chart

In addition to the charts that follow, you might want to consider the [Frequently Asked Questions](https://www.mongodb.com/docs/manual/faq/fundamentals.md#std-label-faq-fundamentals) section for a selection of common questions about MongoDB.

## Terminology and Concepts

The following table presents the various SQL terminology and concepts and the corresponding MongoDB terminology and concepts.

| SQL Terms/Concepts | MongoDB Terms/Concepts |
| --- | --- |
| database | [database](https://www.mongodb.com/docs/manual/reference/glossary.md#std-term-database) |
| table | [collection](https://www.mongodb.com/docs/manual/reference/glossary.md#std-term-collection) |
| row | [document](https://www.mongodb.com/docs/manual/reference/glossary.md#std-term-document) or [BSON](https://www.mongodb.com/docs/manual/reference/glossary.md#std-term-BSON) document |
| column | [field](https://www.mongodb.com/docs/manual/reference/glossary.md#std-term-field) |
| index | [index](https://www.mongodb.com/docs/manual/reference/command/collmod.md#mongodb-collflag-index) |
| table joins | [`$lookup`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup.md#mongodb-pipeline-pipe.-lookup), embedded documents |
| primary key Specify any unique column or column combination as primary key. | [primary key](https://www.mongodb.com/docs/manual/reference/glossary.md#std-term-primary-key) In MongoDB, the primary key is automatically set to the [_id](https://www.mongodb.com/docs/manual/reference/glossary.md#std-term-_id) field. |
| aggregation (e.g. group by) | aggregation pipeline See [SQL to Aggregation Mapping Chart.](https://www.mongodb.com/docs/manual/reference/sql-aggregation-comparison.md) |
| SELECT INTO NEW_TABLE | [`$out`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/out.md#mongodb-pipeline-pipe.-out) See the [SQL to Aggregation Mapping Chart.](https://www.mongodb.com/docs/manual/reference/sql-aggregation-comparison.md) |
| MERGE INTO TABLE | [`$merge`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/merge.md#mongodb-pipeline-pipe.-merge) See the [SQL to Aggregation Mapping Chart.](https://www.mongodb.com/docs/manual/reference/sql-aggregation-comparison.md) |
| UNION ALL | [`$unionWith`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/unionwith.md#mongodb-pipeline-pipe.-unionWith) |
| transactions | [transactions](https://www.mongodb.com/docs/manual/core/transactions.md#std-label-transactions) For many scenarios, the [denormalized data model (embedded documents and arrays)](https://www.mongodb.com/docs/manual/data-modeling/embedding.md#std-label-data-modeling-embedding) will continue to be optimal for your data and use cases instead of multi-document transactions. That is, for many scenarios, modeling your data appropriately will minimize the need for multi-document transactions. |

## Executables

The following table presents some database executables and the corresponding MongoDB executables. This table is *not* meant to be exhaustive.

|  | MongoDB | MySQL | Oracle | Informix | DB2 |
| --- | --- | --- | --- | --- | --- |
| Database Server | [`mongod`](https://www.mongodb.com/docs/manual/reference/program/mongod.md#mongodb-binary-bin.mongod) | `mysqld` | `oracle` | `IDS` | `DB2 Server` |
| Database Client | [`mongosh`](https://www.mongodb.com/docs/mongodb-shell.md#mongodb-binary-bin.mongosh) | `mysql` | `sqlplus` | `DB-Access` | `DB2 Client` |

## Examples

The following table presents the various SQL statements and the corresponding MongoDB statements. The examples in the table assume the following conditions:

- The SQL examples assume a table named `people`.

- The MongoDB examples assume a collection named `people` that contain documents of the following prototype:

  ```javascript
  {
    _id: ObjectId("509a8fb2f3f4948bd2f983a0"),
    user_id: "abc123",
    age: 55,
    status: 'A'
  }
  ```

### Create and Alter

The following table presents the various SQL statements related to table-level actions and the corresponding MongoDB statements.

| SQL Schema Statements | MongoDB Schema Statements |
| --- | --- |
| `CREATE TABLE people (id MEDIUMINT NOT NULL AUTO_INCREMENT, user_id VARCHAR(30), age NUMBER, status CHAR(1), PRIMARY KEY (id))` | Collections are created implicitly on the first [`insertOne()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.insertone.md#mongodb-method-db.collection.insertOne) or [`insertMany()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.insertmany.md#mongodb-method-db.collection.insertMany) operation. MongoDB automatically adds the `_id` primary key if it isn’t specified. For example: `db.people.insertOne({ user_id: "abc123", age: 55, status: "A" })`. You can also create a collection explicitly with `db.createCollection("people")`. |
| `ALTER TABLE people ADD join_date DATETIME` | Collections don’t enforce document structure. To add the field to existing documents, use `db.people.updateMany({}, { $set: { join_date: new Date() } })`. |
| `ALTER TABLE people DROP COLUMN join_date` | Collections don’t enforce document structure. To remove the field from documents, use `db.people.updateMany({}, { $unset: { join_date: "" } })`. |
| `CREATE INDEX idx_user_id_asc ON people(user_id)` | `db.people.createIndex({ user_id: 1 })` |
| `CREATE INDEX idx_user_id_asc_age_desc ON people(user_id, age DESC)` | `db.people.createIndex({ user_id: 1, age: -1 })` |
| `DROP TABLE people` | `db.people.drop()` |

For more information on the methods and operators used, see:

- [`db.collection.insertOne()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.insertone.md#mongodb-method-db.collection.insertOne)

- [`db.collection.insertMany()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.insertmany.md#mongodb-method-db.collection.insertMany)

- [`db.createCollection()`](https://www.mongodb.com/docs/manual/reference/method/db.createcollection.md#mongodb-method-db.createCollection)

- [`db.collection.updateMany()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.updatemany.md#mongodb-method-db.collection.updateMany)

- [`db.collection.createIndex()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.createindex.md#mongodb-method-db.collection.createIndex)

- [`db.collection.drop()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.drop.md#mongodb-method-db.collection.drop)

- [`$set`](https://www.mongodb.com/docs/manual/reference/operator/update/set.md#mongodb-update-up.-set)

- [`$unset`](https://www.mongodb.com/docs/manual/reference/operator/update/unset.md#mongodb-update-up.-unset)

### Insert

The following table presents the various SQL statements related to inserting records into tables and the corresponding MongoDB statements.

| SQL INSERT Statements | MongoDB `insertOne()` Statements |
| --- | --- |
| `INSERT INTO people (user_id, age, status) VALUES ("bcd001", 45, "A")` | `db.people.insertOne({ user_id: "bcd001", age: 45, status: "A" })` |

For more information, see [`db.collection.insertOne()`.](https://www.mongodb.com/docs/manual/reference/method/db.collection.insertone.md#mongodb-method-db.collection.insertOne)

### Select

The following table presents the various SQL statements related to reading records from tables and the corresponding MongoDB statements.

**Note:**

The [`find()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.find.md#mongodb-method-db.collection.find) method always includes the `_id` field in the returned documents unless specifically excluded through [projection](https://www.mongodb.com/docs/manual/reference/glossary.md#std-term-projection). Some of the SQL queries below may include an `_id` field to reflect this, even if the field is not included in the corresponding [`find()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.find.md#mongodb-method-db.collection.find) query.

| SQL SELECT Statements | MongoDB `find()` Statements |
| --- | --- |
| `SELECT * FROM people` | `db.people.find()` |
| `SELECT id, user_id, status FROM people` | `db.people.find({}, { user_id: 1, status: 1 })` |
| `SELECT user_id, status FROM people` | `db.people.find({}, { user_id: 1, status: 1, _id: 0 })` |
| `SELECT * FROM people WHERE status = "A"` | `db.people.find({ status: "A" })` |
| `SELECT user_id, status FROM people WHERE status = "A"` | `db.people.find({ status: "A" }, { user_id: 1, status: 1, _id: 0 })` |
| `SELECT * FROM people WHERE status != "A"` | `db.people.find({ status: { $ne: "A" } })` |
| `SELECT * FROM people WHERE status = "A" AND age = 50` | `db.people.find({ status: "A", age: 50 })` |
| `SELECT * FROM people WHERE status = "A" OR age = 50` | `db.people.find({ $or: [{ status: "A" }, { age: 50 }] })` |
| `SELECT * FROM people WHERE age > 25` | `db.people.find({ age: { $gt: 25 } })` |
| `SELECT * FROM people WHERE age < 25` | `db.people.find({ age: { $lt: 25 } })` |
| `SELECT * FROM people WHERE age > 25 AND age <= 50` | `db.people.find({ age: { $gt: 25, $lte: 50 } })` |
| `SELECT * FROM people WHERE user_id LIKE "%bc%"` | `db.people.find({ user_id: /bc/ })` or `db.people.find({ user_id: { $regex: /bc/ } })` |
| `SELECT * FROM people WHERE user_id LIKE "bc%"` | `db.people.find({ user_id: /^bc/ })` or `db.people.find({ user_id: { $regex: /^bc/ } })` |
| `SELECT * FROM people WHERE status = "A" ORDER BY user_id ASC` | `db.people.find({ status: "A" }).sort({ user_id: 1 })` |
| `SELECT * FROM people WHERE status = "A" ORDER BY user_id DESC` | `db.people.find({ status: "A" }).sort({ user_id: -1 })` |
| `SELECT COUNT(*) FROM people` | `db.people.count()` or `db.people.find().count()` |
| `SELECT COUNT(user_id) FROM people` | `db.people.count({ user_id: { $exists: true } })` or `db.people.find({ user_id: { $exists: true } }).count()` |
| `SELECT COUNT(*) FROM people WHERE age > 30` | `db.people.count({ age: { $gt: 30 } })` or `db.people.find({ age: { $gt: 30 } }).count()` |
| `SELECT DISTINCT(status) FROM people` | `db.people.aggregate([{ $group: { _id: "$status" } }])` or, for distinct value sets within the [BSON size limit](https://www.mongodb.com/docs/manual/reference/limits.md#std-label-limit-bson-document-size), `db.people.distinct("status")` |
| `SELECT * FROM people LIMIT 1` | `db.people.findOne()` or `db.people.find().limit(1)` |
| `SELECT * FROM people LIMIT 5 SKIP 10` | `db.people.find().limit(5).skip(10)` |
| `EXPLAIN SELECT * FROM people WHERE status = "A"` | `db.people.find({ status: "A" }).explain()` |

For more information on the methods and operators used, see

- [`db.collection.find()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.find.md#mongodb-method-db.collection.find)

- [`db.collection.distinct()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.distinct.md#mongodb-method-db.collection.distinct)

- [`db.collection.findOne()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.findone.md#mongodb-method-db.collection.findOne)

- [`limit()`](https://www.mongodb.com/docs/manual/reference/method/cursor.limit.md#mongodb-method-cursor.limit)

- [`skip()`](https://www.mongodb.com/docs/manual/reference/method/cursor.skip.md#mongodb-method-cursor.skip)

- [`explain()`](https://www.mongodb.com/docs/manual/reference/method/cursor.explain.md#mongodb-method-cursor.explain)

- [`sort()`](https://www.mongodb.com/docs/manual/reference/method/cursor.sort.md#mongodb-method-cursor.sort)

- [`count()`](https://www.mongodb.com/docs/manual/reference/method/cursor.count.md#mongodb-method-cursor.count)

- [`$ne`](https://www.mongodb.com/docs/manual/reference/operator/query/ne.md#mongodb-query-op.-ne)

- [`$and`](https://www.mongodb.com/docs/manual/reference/operator/query/and.md#mongodb-query-op.-and)

- [`$or`](https://www.mongodb.com/docs/manual/reference/operator/query/or.md#mongodb-query-op.-or)

- [`$gt`](https://www.mongodb.com/docs/manual/reference/operator/query/gt.md#mongodb-query-op.-gt)

- [`$lt`](https://www.mongodb.com/docs/manual/reference/operator/query/lt.md#mongodb-query-op.-lt)

- [`$exists`](https://www.mongodb.com/docs/manual/reference/operator/query/exists.md#mongodb-query-op.-exists)

- [`$lte`](https://www.mongodb.com/docs/manual/reference/operator/query/lte.md#mongodb-query-op.-lte)

- [`$regex`](https://www.mongodb.com/docs/manual/reference/operator/query/regex.md#mongodb-query-op.-regex)

### Update Records

The following table presents the various SQL statements related to updating existing records in tables and the corresponding MongoDB statements.

| SQL Update Statements | MongoDB `updateMany()` Statements |
| --- | --- |
| `UPDATE people SET status = "C" WHERE age > 25` | `db.people.updateMany({ age: { $gt: 25 } }, { $set: { status: "C" } })` |
| `UPDATE people SET age = age + 3 WHERE status = "A"` | `db.people.updateMany({ status: "A" }, { $inc: { age: 3 } })` |

For more information on the method and operators used in the examples, see:

- [`db.collection.updateMany()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.updatemany.md#mongodb-method-db.collection.updateMany)

- [`$gt`](https://www.mongodb.com/docs/manual/reference/operator/query/gt.md#mongodb-query-op.-gt)

- [`$set`](https://www.mongodb.com/docs/manual/reference/operator/update/set.md#mongodb-update-up.-set)

- [`$inc`](https://www.mongodb.com/docs/manual/reference/operator/update/inc.md#mongodb-update-up.-inc)

### Delete Records

The following table presents the various SQL statements related to deleting records from tables and the corresponding MongoDB statements.

| SQL Delete Statements | MongoDB `deleteMany()` Statements |
| --- | --- |
| `DELETE FROM people WHERE status = "D"` | `db.people.deleteMany({ status: "D" })` |
| `DELETE FROM people` | `db.people.deleteMany({})` |

For more information, see [`db.collection.deleteMany()`.](https://www.mongodb.com/docs/manual/reference/method/db.collection.deletemany.md#mongodb-method-db.collection.deleteMany)

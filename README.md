# MongoDB Tutorial



## Contents

1. [Introduction](#1-introduction)
2. [Installation](#2-installation)
3. [MongoDB Shell](#3-mongodb-shell)
4. [Data Types](#4-data-types)
5. [CRUD: Create and Read](#5-crud-create-and-read)
6. [Queries](#6-queries)
7. [Updates](#7-updates)
8. [Delete](#8-delete)
9. [Aggregation](#9-aggregation)
10. [Indexes](#10-indexes)
11. [Utilities](#11-utilities)
12. [Legacy shell vs mongosh cheat sheet](#12-legacy-shell-vs-mongosh-cheat-sheet)
13. [Practice exercises](#13-practice-exercises)

---

## Practice data used in this tutorial

Run this once in mongosh to create the sample data. The core fields (`_id`, `name`, `age`, `class`, `regno`) match your `school.students` collection; the extra fields (`city`, `marks`, `subjects`, `guardian`, `fees`) are added so that array, embedded-document and aggregation examples have something to work on.

```javascript
use school

db.students.insertMany([
  { name: "Ali Khan",     age: 20, class: "BSCS-4", regno: "FA22-BCS-001", city: "Lahore",
    marks: Int32(78), subjects: ["DB", "OOP", "Maths"],
    guardian: { name: "Imran Khan", phone: "0300-1111111", address: { city: "Lahore", street: "Mall Road" } },
    fees: [ { month: "Jan", amount: Int32(15000), paid: true }, { month: "Feb", amount: Int32(15000), paid: false } ] },

  { name: "Sara Ahmed",   age: 19, class: "BSCS-2", regno: "FA23-BCS-014", city: "Karachi",
    marks: Int32(91), subjects: ["DB", "Web", "English"],
    guardian: { name: "Ahmed Raza", phone: "0301-2222222", address: { city: "Karachi", street: "Clifton" } },
    fees: [ { month: "Jan", amount: Int32(15000), paid: true }, { month: "Feb", amount: Int32(15000), paid: true } ] },

  { name: "Bilal Hussain", age: 22, class: "BSSE-6", regno: "FA21-BSE-007", city: "Islamabad",
    marks: Int32(64), subjects: ["SE", "DB", "Networks", "Maths"],
    guardian: { name: "Hussain Ali", phone: "0302-3333333", address: { city: "Islamabad", street: "F-7" } },
    fees: [ { month: "Jan", amount: Int32(18000), paid: false } ] },

  { name: "Ayesha Malik", age: 21, class: "BSCS-4", regno: "FA22-BCS-022", city: "Lahore",
    marks: Int32(85), subjects: ["DB", "OOP", "AI"],
    guardian: { name: "Tariq Malik", phone: "0303-4444444", address: { city: "Lahore", street: "Gulberg" } },
    fees: [ { month: "Jan", amount: Int32(15000), paid: true } ] },

  { name: "Usman Tariq",  age: 23, class: "BSSE-8", regno: "FA20-BSE-031", city: "Multan",
    marks: Int32(55), subjects: ["SE", "Testing"],
    guardian: { name: "Tariq Mehmood", phone: "0304-5555555", address: { city: "Multan", street: "Bosan Road" } },
    fees: [] },

  { name: "Hina Shah",    age: 20, class: "BSCS-2", regno: "FA23-BCS-040", city: "Karachi",
    marks: Int32(72), subjects: ["Web", "Maths"],
    guardian: { name: "Kamran Shah", phone: "0305-6666666", address: { city: "Karachi", street: "DHA" } },
    fees: [ { month: "Jan", amount: Int32(15000), paid: false } ] }
])
```

> **Reset at any time.** Later examples change and delete documents. To start fresh, run `db.students.drop()` and paste the block above again.

> Plain numbers like `20` are stored as **Double** in BSON. `Int32(78)` stores a 32-bit integer. This difference is explained in [Data Types](#4-data-types).

---

## 1. Introduction

### 1.1 What is MongoDB?

MongoDB is a **document database** (a NoSQL database). Instead of storing rows in tables with a fixed schema, it stores **documents**: self-describing records made of field/value pairs, similar to JSON objects.

```
Document 1          Document 2          Document M
  field1              field1              field1
  field2              field2              field2
  ...                 ...                 ...
  fieldK              fieldL              fieldN
```

Notice that each document can have a **different number of fields** (K, L, N). Documents in the same collection do not have to share a structure. This is called a *flexible schema*.

Comparison with relational databases:

| Relational (SQL)     | MongoDB                      |
|----------------------|------------------------------|
| Database             | Database                     |
| Table                | Collection                   |
| Row                  | Document                     |
| Column               | Field                        |
| Primary key          | `_id` field                  |
| JOIN                 | Embedded documents, or `$lookup` in aggregation |

### 1.2 JSON (JavaScript Object Notation)

A JSON object is a set of `"name": value` pairs inside curly braces:

```json
{
  "name1": value1,
  "name2": value2,
  "nameN": valueN
}
```

JSON supports **6 data types**:

| Type    | Example                          |
|---------|----------------------------------|
| String  | `"That's a sample string"`       |
| Number  | `6`                              |
| Boolean | `true`                           |
| Array   | `["first", "second", "third"]`   |
| Object  | `{ "key1": 1, "key2": "Sample" }`|
| Null    | `null`                           |

A complete example using all six, including a nested object inside an object:

```json
{
  "string": "That's a sample string",
  "number": 6,
  "boolean": true,
  "array": ["first", "second", "third"],
  "object": {
    "key1": 1,
    "key2": "Sample",
    "key3": true,
    "key4": [1, 2, 3],
    "key5": { "nestedObjKey1": 10, "nestedObjKey2": false }
  },
  "null": null
}
```

### 1.3 BSON (Binary JSON)

MongoDB does **not** store JSON text. It stores documents in **BSON**, a binary encoding of JSON-like documents. BSON is faster to scan and supports **more data types** than JSON:

| JSON types | BSON types |
|------------|------------|
| String     | String |
| Number     | Double, 32-bit Integer, 64-bit Integer, Decimal128 |
| Boolean    | Boolean |
| Array      | Array |
| Object     | Object (embedded document) |
| Null       | Null |
| (none)     | Regular Expression, Timestamp, Binary data, Date, ObjectId, and others |

The problem: JSON has only one `Number` type and has no Date or ObjectId at all. So how do you write a BSON Date or a 32-bit integer in plain JSON text? The answer is **Extended JSON**.

### 1.4 Extended JSON

Extended JSON is a way of writing BSON types as text. It has two modes:

| Shell Mode | Strict Mode |
|------------|-------------|
| Writes BSON types inline using constructors like `ObjectId(...)`, `NumberInt(...)`, `ISODate(...)` | Writes BSON types using special keys that start with `$`, like `{ "$oid": ... }` |
| Internal MongoDB format | Valid standard JSON |
| Understood by the MongoDB Shell | Understood by any JSON parser |

Both are supported by MongoDB drivers, the REST API and `mongoimport`.

**Same document in both modes:**

Shell mode:

```javascript
{
  "_id": ObjectId("58be99e912eb83b7e4f5b07c"),
  "name": "Bonita Hayes",
  "age": NumberInt(39),
  "registered": ISODate("2018-03-24T01:24:10-02:00")
}
```

Strict mode:

```json
{
  "_id": { "$oid": "58be99e912eb83b7e4f5b07c" },
  "name": "Bonita Hayes",
  "age": 39,
  "registered": { "$date": "2018-03-24T01:24:10-02:00" }
}
```

> **Modern naming.** Current MongoDB documentation calls these Extended JSON v2 modes **Canonical** (preserves every type exactly, e.g. `{"$numberInt": "39"}`) and **Relaxed** (more readable, e.g. plain `39` for an int). "Strict" and "Shell" mode are the older (v1) names. The idea is the same: `$`-prefixed keys represent types JSON doesn't have.

### 1.5 MongoDB Structure

```
MongoDB server
 ├── Database  (e.g. school)
 │    ├── Collection  (e.g. students)
 │    │     ├── Document
 │    │     └── Document
 │    └── Collection  (e.g. teachers)
 │          └── Document
 └── Database  (e.g. shop)
      └── Collection ...
```

- A **server** holds many **databases**.
- A **database** holds many **collections**.
- A **collection** holds many **documents**.

### 1.6 MongoDB Architecture

MongoDB is a set of programs:

| Program | Role |
|---------|------|
| `mongod` | The **database server** (daemon). It stores data and answers requests. |
| `mongosh` | The **shell** client (replaces the old `mongo` shell). |
| `mongodump` / `mongorestore` | Binary backup and restore. |
| `mongoexport` / `mongoimport` | Export/import JSON or CSV. |
| `mongostat` / `mongotop` | Live monitoring. |
| Connectors | e.g. the BI Connector, Kafka Connector, Spark Connector. |

### 1.7 How applications talk to MongoDB

```
             Create / Read / Update / Delete
 Mongo client  ───────────────────────────────►  Mongo server
 (mongosh, Compass,                              (mongod)
  or your app via a driver:
  Node.js, Java, .NET, Ruby, Python ...)
```

Every client, whether the shell or an application using a driver, sends CRUD operations to `mongod`.

> **Note:** SSL/TLS encryption is strongly recommended for any connection that leaves your own machine.

### Summary

- MongoDB is a document database; documents are JSON-like.
- JSON has 6 data types; BSON (how MongoDB stores data) has many more.
- Extended JSON writes BSON types as text (Shell/Strict, now Canonical/Relaxed).
- Structure: Server → Database → Collection → Document.
- `mongod` is the server; `mongosh` is the shell; drivers connect applications.

---

## 2. Installation

### 2.1 Installation options

| Option | Good for | Notes |
|--------|----------|-------|
| **1. Local Mac or PC** | Learning, development | Single server, not for production. |
| **2. Dedicated or virtual server** | Self-managed production | Full control, but you handle management, backups, upgrades. |
| **3. MongoDB Atlas (cloud database as a service)** | Production, quick start | Replica set out of the box, easy scaling, **free size-limited tier** available. |

### 2.2 What to install locally

Since MongoDB 4.4/5.0 the pieces are downloaded separately:

1. **MongoDB Community Server** (`mongod`): https://www.mongodb.com/try/download/community
2. **mongosh** (the shell): https://www.mongodb.com/try/download/shell
3. **MongoDB Database Tools** (`mongodump`, `mongoexport`, `mongoimport`, `mongostat`, `mongotop` ...): https://www.mongodb.com/try/download/database-tools
4. Optional GUI: **MongoDB Compass** (official). **Robo 3T** is another GUI, though no longer maintained; Studio 3T is its successor.

**Windows:** run the `.msi` installer and choose "Install MongoDB as a Service". Add the `bin` folders of mongosh and the tools to your `PATH`.

**macOS (Homebrew):**

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Ubuntu/Debian:** follow the official apt repository instructions for your version, then:

```bash
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 2.3 Check that it works

```bash
mongod --version      # server version
mongosh --version     # shell version
mongosh               # connects to mongodb://127.0.0.1:27017 by default
```

Connecting to Atlas or a remote server:

```bash
mongosh "mongodb+srv://cluster0.xxxxx.mongodb.net/school" --username <user>
```

The default port is **27017**.

### Summary

- Local install for learning; Atlas for production (free tier available).
- Install Server, mongosh and Database Tools; Compass is an optional GUI.
- Verify with `mongod --version` and `mongosh --version`.

---

## 3. MongoDB Shell

### 3.1 What the shell is

The MongoDB Shell is a **JavaScript** environment connected to a MongoDB server. You can type normal JavaScript (variables, loops, functions) as well as database commands.

- The legacy `mongo` shell used the **SpiderMonkey** engine from v3.2 and supported **ES6**.
- Today: **mongosh** runs on **Node.js**, so it supports modern JavaScript (ES2020+, `async/await`, arrow functions, `let/const`).

```javascript
// Plain JavaScript works in the shell
let x = 5
for (let i = 0; i < 3; i++) print(i * x)
const square = n => n * n
square(9)        // 81
```

### 3.2 Checking versions

| What | mongosh | Legacy |
|------|---------|-----------------|
| Server version, from the OS | `mongod --version` | same |
| Server version, from the shell | `db.version()` | same |
| Detailed server build info | `db.serverBuildInfo()` | same |
| Shell version, from the OS | `mongosh --version` | `mongo --version` |
| Shell version, from the shell | `version()` | same |
| JavaScript engine | Node.js (`process.version`) | `interpreterVersion()` |

### 3.3 Shell JavaScript syntax

```javascript
db.version()
```

- `db` is an **object** (the current database).
- `.version` is a **property** of that object (property access with `.`).
- `version` holds a **function**, which makes it a **method**; `()` invokes it.

**Methods with arguments:**

```javascript
db.getCollection("test").insertOne({ a: 10, b: true })
```

1. `"test"` is a **string argument** passed to `getCollection`.
2. `getCollection("test")` **returns a collection object** with its own methods.
3. `{ a: 10, b: true }` is an **object argument** passed to `insertOne`.

`db.getCollection("test")` and `db.test` are equivalent. Use `getCollection()` when the collection name has spaces, dashes or starts with a number, e.g. `db.getCollection("class-2024")`.

### 3.4 Useful shell helpers

```javascript
help                 // general help
db.help()            // database methods
db.students.help()   // collection methods
show dbs             // list databases
use school           // switch database
show collections     // list collections
cls                  // clear the screen (mongosh)
it                   // show the next 20 results of the last query
exit                 // leave the shell
```

### Summary

- The shell is JavaScript; mongosh runs on Node.js.
- `db.version()` = object `db`, method `version`, invoked with `()`.
- Methods can take strings and objects, and can return objects with their own methods.

---

## 4. Data Types

### 4.1 Most common BSON types and their shell syntax

| Type | Shell syntax (mongosh) | Legacy shell syntax |
|------|------------------------|---------------------|
| String | `"text"` | same |
| Object | `{ }` | same |
| Array | `[ ]` | same |
| Boolean | `true` / `false` | same |
| 32-bit Integer | `Int32(10)` or `NumberInt(10)` | `NumberInt(10)` |
| 64-bit Integer | `Long(10)` or `NumberLong(10)` | `NumberLong(10)` |
| Double | `10`, `0.0`, `5.75` | same |
| Decimal128 | `Decimal128("9.99")` or `NumberDecimal("9.99")` | `NumberDecimal("9.99")` |
| Date | `new Date()` or `ISODate()` | same |
| ObjectId | `ObjectId()` | same |

> **CAUTION:** If you don't specify a number type, the number is stored as a **Double**. `age: 20` is a Double; `age: Int32(20)` is a 32-bit integer.

### 4.2 BSON type identifiers

Every BSON type has a number and a string alias. You use them with the `$type` operator to find documents by the type of a field.

| Type | Number | String alias |
|------|--------|--------------|
| Double | 1 | `"double"` |
| String | 2 | `"string"` |
| Object | 3 | `"object"` |
| Array | 4 | `"array"` |
| ObjectId | 7 | `"objectId"` |
| Boolean | 8 | `"bool"` |
| Date | 9 | `"date"` |
| Null | 10 | `"null"` |
| Regular Expression | 11 | `"regex"` |
| 32-bit Integer | 16 | `"int"` |
| Timestamp | 17 | `"timestamp"` |
| 64-bit Integer | 18 | `"long"` |
| Decimal128 | 19 | `"decimal"` |

```javascript
db.students.find({ marks: { $type: "int" } })     // marks stored as Int32
db.students.find({ age:   { $type: "double" } })  // age stored as Double (plain number)
db.students.find({ name:  { $type: 2 } })         // same as "string"
```

### 4.3 The `_id` field

- Every document **must** have an `_id` field. It is the primary key and is unique within the collection.
- You can assign it yourself (`_id: "FA22-BCS-001"`), but if you don't, MongoDB creates an **ObjectId** automatically. Letting MongoDB generate it is recommended.

```javascript
db.students.insertOne({ _id: "FA24-BCS-099", name: "Manual Id", age: 18 })  // custom _id
db.students.insertOne({ name: "Auto Id", age: 18 })                          // _id generated
```

### 4.4 ObjectId

An ObjectId is a 12-byte value, shown as 24 hex characters:

```
ObjectId("54759eb3c090d83494e2d804")
```

Layout in current MongoDB versions:

| Bytes | Content |
|-------|---------|
| 4 | Timestamp: seconds since the Unix epoch |
| 5 | Random value, unique per machine and process |
| 3 | Counter, starting from a random number |

> Older MongoDB versions used a different layout (4 bytes time, 3 bytes machine id, 2 bytes process id, 3 bytes counter). The total is still 12 bytes and the timestamp is still first, which is why ObjectIds sort roughly by creation time.

You can read the creation time back:

```javascript
ObjectId("54759eb3c090d83494e2d804").getTimestamp()
// ISODate("2014-11-26T09:41:07.000Z")
```

### 4.5 Date and ISODate

Dates are stored as BSON **Date** (milliseconds since the epoch, in UTC) and are displayed as `ISODate(...)`.

```javascript
new Date()          // current date/time as a BSON Date -> ISODate("2026-10-19T17:45:00.123Z")
ISODate()           // same thing
Date()              // CAUTION: returns a STRING, not a Date object
```

Converting values to dates (results shown in UTC):

| Input | Stored as |
|-------|-----------|
| `new Date("2018-08-08")` | `ISODate("2018-08-08T00:00:00Z")` |
| `new Date("August 8, 2018 13:15:00")` | interpreted in the shell's **local time zone** (on a UTC+3 machine it becomes `2018-08-08T10:15:00Z`) |
| `new Date(2018, 7, 8)` | months start at 0, so `7` = August; also local time (`2018-08-07T21:00:00Z` on a UTC+3 machine) |
| `ISODate("2018-08-08T08:22:55.160Z")` | exactly that UTC instant |

Tip: always write dates as ISO strings with `Z` (UTC) to avoid time-zone surprises.

```javascript
db.students.updateOne({ regno: "FA22-BCS-001" }, { $set: { admitted: ISODate("2022-09-01T00:00:00Z") } })
```

### 4.6 Numbers in BSON

| Input | Stored value | Type |
|-------|--------------|------|
| `10` | `10` (displayed `10`, stored `10.0`) | `"double"` |
| `0` | `0.0` | `"double"` |
| `5.75` | `5.75` | `"double"` |
| `Int32(10)` / `NumberInt(10)` | `10` | `"int"` |
| `Long(1234)` / `NumberLong(1234)` | `1234` | `"long"` |
| `Decimal128("19.99")` | `19.99` exactly | `"decimal"` |

Use Int32/Long for counters and ids, Double for measurements, and Decimal128 for money.

### Summary

- Documents are stored as BSON.
- By default all numbers are Doubles; use `Int32()`/`NumberInt()` or `Long()`/`NumberLong()` for integers.
- `_id` is mandatory; ObjectId generates a unique value for it.
- Dates are stored as BSON Date and displayed with `ISODate`.

---

## 5. CRUD: Create and Read

CRUD = **C**reate, **R**ead, **U**pdate, **D**elete. This chapter covers Create and Read; Update and Delete have their own chapters.

### 5.1 Exploring databases and collections

```javascript
db                    // show the active database
show dbs              // list all databases (only those containing data)
use school            // switch to (or prepare to create) the "school" database
show collections      // list collections in the active database
```

### 5.2 Creating and deleting databases and collections

```javascript
use school                              // (1) switch database
db.createCollection("teachers")         // (2) create a collection explicitly
show collections                        // (3) list collections
db.getCollection("teachers").drop()     // (4) delete a collection
db.teachers.drop()                      //     same thing, shorter
db.dropDatabase()                       // (5) delete the active database
```

> **Note:** There is **no command to create a database**. `use school` only selects the name; the database is actually created when you create its first collection or insert its first document. Likewise, inserting into a collection that doesn't exist creates it automatically.

### 5.3 Inserting documents

| Method | Inserts | Returns |
|--------|---------|---------|
| `insertOne(<object>)` | one document | `{ acknowledged, insertedId }` |
| `insertMany(<array>)` | many documents | `{ acknowledged, insertedIds }` |
| `insert(<object or array>)` | **Legacy**, deprecated in mongosh | `WriteResult` / `BulkWriteResult` |

**insertOne()**

```javascript
db.students.insertOne({
  name: "Zain Abbas",
  age: 19,
  class: "BSCS-2",
  regno: "FA23-BCS-050"
})
```

Result:

```javascript
{
  acknowledged: true,
  insertedId: ObjectId("5ad06d63be9df1be43808588")
}
```

**insertMany()**

```javascript
db.students.insertMany([
  { name: "Fatima Noor", age: 20, class: "BSSE-4", regno: "FA22-BSE-011" },
  { name: "Hamza Iqbal", age: 21, class: "BSSE-4", regno: "FA22-BSE-012" },
  { name: "Maryam Ali",  age: 19, class: "BSCS-2", regno: "FA23-BCS-051" }
])
```

Result:

```javascript
{
  acknowledged: true,
  insertedIds: {
    '0': ObjectId("5ad06d71be9df1be43808589"),
    '1': ObjectId("5ad06d71be9df1be4380858a"),
    '2': ObjectId("5ad06d71be9df1be4380858b")
  }
}
```

By default `insertMany` is **ordered**: if one document fails (e.g. duplicate `_id`), it stops there. Pass `{ ordered: false }` to continue with the rest:

```javascript
db.students.insertMany([ /* docs */ ], { ordered: false })
```

**Legacy:** `insert()`

```javascript
db.students.insert({ name: "Old Style", age: 20 })
// WriteResult({ "nInserted" : 1 })

db.students.insert([{ name: "A" }, { name: "B" }, { name: "C" }])
// BulkWriteResult({ "nInserted" : 3, "writeErrors" : [ ], ... })
```

In mongosh, `insert()` still runs but prints a deprecation warning. Use `insertOne` / `insertMany`.

### 5.4 Reading documents

| Method | Returns |
|--------|---------|
| `find(<query>, <projection>)` | a **cursor** (must be iterated) |
| `findOne(<query>, <projection>)` | a single document (or `null`) |

```javascript
db.students.find()                              // all documents
db.students.find({ class: "BSCS-4" })           // documents matching a query
db.students.find({ class: "BSCS-4" }, { name: 1, regno: 1 })  // only some fields
db.students.findOne({ regno: "FA23-BCS-014" })  // one document
db.students.findOne()                           // the first document in natural order
```

Both arguments are optional. The query syntax is covered in [Queries](#6-queries).

### 5.5 Cursors

`find()` doesn't return documents directly. It returns a **cursor**: a pointer to the result set on the server, which the client pulls **in batches**.

```
 Client                                   Server
   │  find()  ─── first batch request ───►  │
   │  ◄────────── {...} ... {...} ──────────│
   │  next batch request ─────────────────► │
   │  ◄────────── {...} ... {...} ──────────│
```

- Initial batch: **101 documents** or **1 MB**, whichever comes first (older servers; modern servers use 16 MB / 101 docs for the first batch).
- Following batches: up to the max BSON message size (**16 MB**).
- The **shell** displays **20 documents** at a time. Type `it` to see the next 20.

Change how many the shell displays:

```javascript
config.set("displayBatchSize", 50)       // mongosh
// legacy shell: DBQuery.shellBatchSize = 50
```

Control the server batch size:

```javascript
db.students.find().batchSize(2)
```

### 5.6 Cursor iteration methods

```javascript
const cursor = db.students.find({ class: "BSCS-2" })

cursor.hasNext()          // true if another document is available
cursor.next()             // returns the next document
cursor.objsLeftInBatch()  // documents left in the current batch
```

Loop manually:

```javascript
const cursor = db.students.find()
while (cursor.hasNext()) {
  const s = cursor.next()
  print(s.name + " - " + s.regno)
}
```

Iterate everything with a function:

```javascript
db.students.find().forEach(s => print(`${s.name} is ${s.age}`))
```

Put everything into an array:

```javascript
const all = db.students.find().toArray()
all.length
all[0].name
```

> A cursor can be iterated only **once**. After `toArray()` or a full `forEach()`, create a new cursor to read again.

### 5.7 Count, limit, skip and sort

```javascript
db.students.find().limit(3)                           // first 3 documents
db.students.find().skip(2)                            // skip the first 2
db.students.find().sort({ age: 1 })                   // age ascending
db.students.find().sort({ class: 1, marks: -1 })      // class ascending, then marks descending
db.students.find().sort({ marks: -1 }).limit(3)       // top 3 students by marks
db.students.find().sort({ name: 1 }).skip(5).limit(5) // "page 2" with 5 per page
```

**Counting**

| Task | mongosh | Legacy |
|------|---------|-----------------|
| Count matching documents | `db.students.countDocuments({ class: "BSCS-4" })` | `db.students.find({ class: "BSCS-4" }).count()` |
| Fast approximate total | `db.students.estimatedDocumentCount()` | `db.students.count()` |

`cursor.count()` still works in mongosh but is deprecated.

**Precedence:** no matter what order you chain them in, MongoDB always applies

```
1. SORT   →   2. SKIP   →   3. LIMIT
```

So `find().limit(3).sort({ marks: -1 })` still returns the top 3 by marks, not 3 random documents sorted afterwards.

### 5.8 findOne()

`findOne()` returns a single document object (not a cursor), so you can use its fields directly:

```javascript
const s = db.students.findOne({ regno: "FA22-BCS-001" })
s.name          // "Ali Khan"
s.guardian.phone
```

If nothing matches it returns `null`.

### Summary

- `use`, `show dbs`, `show collections`, `createCollection()`, `drop()`, `dropDatabase()`.
- Insert with `insertOne()` and `insertMany()` (legacy: `insert()`).
- `find()` returns a cursor; `findOne()` returns one document.
- Cursor methods: `next()`, `hasNext()`, `objsLeftInBatch()`, `toArray()`, `forEach()`, `batchSize()`.
- `sort()`, `skip()`, `limit()` are always applied in that order; count with `countDocuments()` (legacy: `count()`).

---

## 6. Queries

The first argument of `find()`, `findOne()`, `countDocuments()`, `updateOne()`, `deleteMany()` etc. is a **query filter**. Everything in this chapter works in all of them.

### 6.1 Equality queries

Match documents where a field has an exact value:

```javascript
{ <field1>: <value1>, <field2>: <value2>, ... }
```

```javascript
db.students.find({ name: "Ali Khan" })
db.students.find({ age: 20 })
db.students.find({ class: "BSCS-4", city: "Lahore" })   // both must match (implicit AND)
```

Listing several fields in one object is an **AND** condition.

### 6.2 Query operators

Operators add conditions. They go inside an object as the field's value:

```javascript
{ <field>: { <operator>: <value> } }
```

### 6.3 Comparison operators

| Operator | Meaning |
|----------|---------|
| `$eq` | equal |
| `$ne` | not equal |
| `$gt` | greater than |
| `$gte` | greater than or equal |
| `$lt` | less than |
| `$lte` | less than or equal |
| `$in` | equal to any value in the array |
| `$nin` | equal to none of the values in the array |

```javascript
db.students.find({ city: { $ne: "Lahore" } })
db.students.find({ age: { $lt: 21 } })
db.students.find({ marks: { $gte: 80 } })
db.students.find({ age: { $gt: 19, $lt: 23 } })                   // range: 20, 21, 22
db.students.find({ class: { $in: ["BSCS-2", "BSCS-4"] } })
db.students.find({ city: { $nin: ["Karachi", "Lahore"] } })
```

### 6.4 Logical operators

**`$and`**: all conditions must match.

```javascript
{ $and: [ { <condition1> }, { <condition2> }, ... ] }
```

```javascript
db.students.find({ $and: [ { class: "BSCS-4" }, { age: 21 } ] })
// same as the implicit form:
db.students.find({ class: "BSCS-4", age: 21 })
```

**Explicit `$and` is required when conditions use the same field or the same operator twice.** A JavaScript object can't have two keys with the same name; the second one silently overwrites the first:

```javascript
// WRONG: becomes just { age: { $gte: 20 } }, the $ne is lost
db.students.find({ age: { $ne: 21 }, age: { $gte: 20 } })

// RIGHT
db.students.find({ $and: [ { age: { $ne: 21 } }, { age: { $gte: 20 } } ] })

// Also right: several operators on one field in a single object
db.students.find({ age: { $ne: 21, $gte: 20 } })
```

A typical case where you really need explicit `$and` is combining two `$or`s:

```javascript
db.students.find({ $and: [
  { $or: [ { city: "Lahore" }, { city: "Karachi" } ] },
  { $or: [ { marks: { $gte: 85 } }, { age: { $lt: 20 } } ] }
] })
```

**`$or`**: at least one condition must match.

```javascript
db.students.find({ $or: [ { class: "BSSE-6" }, { age: 19 } ] })
db.students.find({ $or: [ { age: 20 }, { age: 23 } ] })
// same field, several values: $in is simpler
db.students.find({ age: { $in: [20, 23] } })
```

**`$not`**: negates an operator expression.

```javascript
db.students.find({ marks: { $not: { $gte: 60 } } })   // marks < 60, OR marks field missing
```

**`$nor`**: none of the conditions match.

```javascript
db.students.find({ $nor: [ { city: "Lahore" }, { class: "BSCS-2" } ] })
```

### 6.5 Querying embedded documents

Use **dot notation** to reach fields inside embedded documents:

```javascript
db.students.find({ "guardian.name": "Imran Khan" })
db.students.find({ "guardian.address.city": "Karachi" })
```

> **Note:** Field paths with dots **must be in quotes**. `{ guardian.name: "x" }` is a syntax error.

Matching the whole embedded document is also possible but requires the **exact** same fields in the **same order**, so dot notation is almost always what you want:

```javascript
db.students.find({ guardian: { name: "Imran Khan", phone: "0300-1111111",
                               address: { city: "Lahore", street: "Mall Road" } } })
```

### 6.6 Querying arrays by element value

```javascript
db.students.find({ subjects: "DB" })        // array contains "DB" anywhere
db.students.find({ "subjects.0": "DB" })    // first element is "DB"
db.students.find({ "subjects.2": "Maths" }) // third element is "Maths"
```

### 6.7 `$all` and `$size`

```javascript
db.students.find({ subjects: { $all: ["DB", "OOP"] } })   // contains both, in any order
db.students.find({ subjects: { $size: 4 } })              // exactly 4 elements
```

Compare with exact array matching, where order and length must match:

```javascript
db.students.find({ subjects: ["DB", "OOP", "AI"] })
```

### 6.8 Arrays of embedded documents

Each student has `fees: [ { month, amount, paid }, ... ]`.

```javascript
db.students.find({ "fees.month": "Feb" })              // some fee entry has month "Feb"
db.students.find({ fees: { month: "Jan", amount: Int32(15000), paid: true } })  // exact element match
```

### 6.9 `$elemMatch`

With dot notation, each condition can be satisfied by a **different** element. `$elemMatch` requires **one single element** to satisfy **all** conditions (order of conditions doesn't matter):

```javascript
{ <arrayField>: { $elemMatch: { <condition1>, <condition2>, ... } } }
```

```javascript
// Students with an UNPAID fee for FEBRUARY (same element)
db.students.find({ fees: { $elemMatch: { month: "Feb", paid: false } } })

// Compare: some element is Feb AND some (maybe other) element is unpaid
db.students.find({ "fees.month": "Feb", "fees.paid": false })
```

Here's a case where they differ: a student whose Jan fee is unpaid and Feb fee is paid matches the second query but not the first.

### 6.10 Element operators: `$exists` and `$type`

```javascript
db.students.find({ guardian: { $exists: true } })    // field is present
db.students.find({ email:    { $exists: false } })   // field is missing
db.students.find({ marks: { $type: "int" } })
db.students.find({ name:  { $type: 2 } })            // 2 = string
db.students.find({ age:   { $type: ["int", "double"] } })   // either type
db.students.find({ marks: { $type: "int", $eq: 78 } })
```

### 6.11 Projection: choosing which fields come back

The second argument of `find()` / `findOne()` is the **projection**:

```javascript
db.students.find({}, { name: 1, age: 1 })               // include name, age (and _id)
db.students.find({}, { _id: 0, name: 1, regno: 1 })     // exclude _id
db.students.find({}, { "guardian.address": 1, name: 1 })// include a nested part
db.students.find({}, { fees: 0, guardian: 0 })          // everything EXCEPT these
```

Rules:

- `1` includes a field, `0` excludes it.
- `_id` is included unless you write `_id: 0`.
- You **can't mix** inclusion and exclusion in one projection, except for `_id`. `{ name: 1, age: 0 }` is an error.

Example output of `find({ regno: "FA22-BCS-001" }, { _id: 0, name: 1, "guardian.address.city": 1 })`:

```javascript
{ name: "Ali Khan", guardian: { address: { city: "Lahore" } } }
```

Array projection operators (useful extras):

```javascript
db.students.find({}, { name: 1, subjects: { $slice: 2 } })              // first 2 subjects
db.students.find({ "fees.paid": false }, { name: 1, "fees.$": 1 })       // first matching element
```

### 6.12 `$regex`: pattern matching

```javascript
{ <field>: { $regex: /pattern/<options> } }
{ <field>: { $regex: "pattern", $options: "<options>" } }
```

```javascript
db.students.find({ name: { $regex: /khan/i } })            // contains "khan", case-insensitive
db.students.find({ name: /^A/ })                           // starts with "A" (short form)
db.students.find({ regno: { $regex: "BCS" } })             // contains "BCS"
db.students.find({ regno: { $regex: "^fa23", $options: "i" } })
db.students.find({ subjects: { $regex: /^db$/i } })        // works on arrays too
```

Common options: `i` case-insensitive, `m` multiline, `x` ignore whitespace, `s` dot matches newline.

> Performance tip: only a **prefix** regex like `/^FA23/` (case-sensitive) can use an index efficiently.

### Summary

- Equality: `{ field: value }`; multiple fields mean AND.
- Comparison: `$eq $ne $gt $gte $lt $lte $in $nin`.
- Logical: `$and $or $not $nor`; use explicit `$and` for repeated fields/operators.
- Dot notation (in quotes) for embedded documents and array positions.
- Arrays: `$all`, `$size`, `$elemMatch`.
- Element: `$exists`, `$type`.
- Projection: `{ field: 1 }` or `{ field: 0 }`; `$regex` for patterns.

---

## 7. Updates

### 7.1 Update methods

| Method | Updates | Returns |
|--------|---------|---------|
| `updateOne(filter, update, options)` | first matching document | `{ acknowledged, matchedCount, modifiedCount, upsertedId }` |
| `updateMany(filter, update, options)` | all matching documents | same |
| `replaceOne(filter, replacement, options)` | replaces the whole first matching document | same |
| `update(filter, update, options)` | **Legacy**, one document, or many with `{ multi: true }` | `WriteResult` |

General syntax:

```javascript
db.<collection>.<method>( <filter>, <update>, <options> )
```

> In mongosh, `updateOne` and `updateMany` **require update operators** (`$set`, `$inc` ...). To replace a whole document, use `replaceOne`.

### 7.2 Understanding the result

```javascript
db.students.updateOne({ regno: "FA22-BCS-001" }, { $set: { city: "Lahore" } })
```

```javascript
{ acknowledged: true, insertedId: null, matchedCount: 1, modifiedCount: 0, upsertedCount: 0 }
```

- `matchedCount`: how many documents matched the filter.
- `modifiedCount`: how many actually changed. Here it is 0 because the city was **already** "Lahore".

| Situation | matched | modified |
|-----------|---------|----------|
| matched and changed | 1 | 1 |
| matched but value already the same | 1 | 0 |
| nothing matched | 0 | 0 |

**Legacy** equivalent output: `WriteResult({ "nMatched" : 1, "nUpserted" : 0, "nModified" : 0 })`.

### 7.3 Field update operators

| Operator | Does |
|----------|------|
| `$set` | sets or replaces a field's value (creates the field if missing) |
| `$unset` | removes a field |
| `$rename` | renames a field |
| `$inc` | increments by an amount (negative to decrement) |
| `$mul` | multiplies by a number |
| `$min` / `$max` | updates only if the new value is smaller / larger |
| `$currentDate` | sets a field to the current date |

**`$set`**

```javascript
db.students.updateOne(
  { regno: "FA23-BCS-014" },
  { $set: {
      class: "BSCS-3",
      email: "sara@school.edu",
      "guardian.phone": "0301-9999999"     // nested field with dot notation
  } }
)
```

Another example (shoppingCart):

```javascript
db.shoppingCart.updateOne(
  { index: 3 },
  { $set: {
      cartId: NumberInt(325),
      customer: { name: "Mike Foster", email: "mfoster@test.com", age: NumberInt(27) },
      cart: []
  } }
)
```

**`$unset`**: the value you give (`1`, `""`, `true`) doesn't matter.

```javascript
db.students.updateOne({ regno: "FA23-BCS-014" }, { $unset: { email: 1, "guardian.phone": 1 } })
```

**Combining several operators** in one update:

```javascript
db.students.updateOne(
  { regno: "FA22-BCS-022" },
  {
    $set:   { class: "BSCS-5", "guardian.name": "Tariq Malik Sr." },
    $unset: { city: 1 }
  }
)
```

**`$rename`**: if the field doesn't exist, nothing happens.

```javascript
db.students.updateMany(
  { regno: { $exists: true } },
  { $rename: { regno: "registrationNo", anotherField: "anotherName" } }
)
// rename back for the rest of the tutorial:
db.students.updateMany({}, { $rename: { registrationNo: "regno" } })
```

**`$currentDate`**

```javascript
db.students.updateOne({ regno: "FA22-BCS-001" }, { $currentDate: { lastModified: true } })
```

**`$inc`** and **`$mul`**

```javascript
db.students.updateOne({ regno: "FA22-BCS-001" }, { $inc: { marks: Int32(5) } })    // +5
db.students.updateOne({ regno: "FA22-BCS-001" }, { $inc: { marks: Int32(-2) } })   // -2
db.students.updateMany({ class: "BSCS-2" }, { $inc: { age: 1 } })                  // everyone 1 year older
db.students.updateOne({ regno: "FA21-BSE-007" }, { $mul: { marks: 1.1 } })          // +10%
```

> **Note on types:** `$inc` with a plain number (like `5`) on an `Int32` field converts the result to **Double**. Use `Int32(5)` / `NumberInt(5)` to keep it an integer. If the field doesn't exist, `$inc` creates it with the given amount.

**`$min` / `$max`**

```javascript
db.students.updateOne({ regno: "FA22-BCS-001" }, { $max: { marks: Int32(80) } })  // set to 80 only if current < 80
```

### 7.4 updateMany()

```javascript
db.students.updateMany({ city: "Lahore" }, { $set: { campus: "Lahore Campus" } })
// { acknowledged: true, matchedCount: 2, modifiedCount: 2, ... }

db.students.updateMany({}, { $set: { active: true } })   // every document
```

**Legacy:** `update()` updates only the **first** match unless you pass `{ multi: true }`:

```javascript
db.students.update({ city: "Lahore" }, { $set: { campus: "Lahore Campus" } }, { multi: true })
// WriteResult({ "nMatched" : 2, "nUpserted" : 0, "nModified" : 2 })
```

### 7.5 replaceOne()

Replaces **everything** except `_id`:

```javascript
db.students.replaceOne(
  { regno: "FA20-BSE-031" },
  { name: "Usman Tariq", age: 23, class: "BSSE-8", regno: "FA20-BSE-031", status: "graduated" }
)
```

All other fields of that student (marks, subjects, guardian, fees ...) are gone after this. Use `$set` if you only want to change some fields.

### 7.6 Upsert

With `{ upsert: true }`, if no document matches, a new one is **inserted**:

```javascript
db.students.updateOne(
  { regno: "FA24-BCS-100" },
  { $set: { name: "New Student", age: 18, class: "BSCS-1" } },
  { upsert: true }
)
// { matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: ObjectId("...") }
```

The new document contains the filter's equality fields (`regno`) plus the `$set` fields.

### 7.7 Array update operators

| Operator | Does |
|----------|------|
| `$push` | appends an element (creates the array if missing) |
| `$addToSet` | appends only if the element isn't already there |
| `$pop` | removes the first (`-1`) or last (`1`) element |
| `$pull` | removes all elements matching a value or condition |
| `$pullAll` | removes all elements equal to any of the listed values |
| `$` | positional: the first array element that matched the filter |
| `$[]` | all elements of the array |
| `$[<id>]` | elements that match `arrayFilters` |

**`$push`**, with `$each` to push several:

```javascript
db.students.updateOne({ regno: "FA23-BCS-040" }, { $push: { subjects: "DB" } })
db.students.updateOne({ regno: "FA23-BCS-040" }, { $push: { subjects: { $each: ["AI", "OOP"] } } })
```

`$push` modifiers you can add next to `$each`: `$sort`, `$slice`, `$position`:

```javascript
// add a fee record and keep only the last 12
db.students.updateOne(
  { regno: "FA22-BCS-001" },
  { $push: { fees: { $each: [ { month: "Mar", amount: Int32(15000), paid: false } ], $slice: -12 } } }
)
```

**`$addToSet`**: no duplicates.

```javascript
db.students.updateOne({ regno: "FA23-BCS-040" }, { $addToSet: { subjects: "Maths" } })   // already there: no change
db.students.updateOne({ regno: "FA23-BCS-040" }, { $addToSet: { subjects: { $each: ["Maths", "Stats"] } } })  // only Stats added
```

**`$pop`**

```javascript
db.students.updateOne({ regno: "FA23-BCS-040" }, { $pop: { subjects: 1 } })    // remove last
db.students.updateOne({ regno: "FA23-BCS-040" }, { $pop: { subjects: -1 } })   // remove first
```

**`$pull`**: by value or by condition.

```javascript
db.students.updateOne({ regno: "FA21-BSE-007" }, { $pull: { subjects: "Networks" } })
db.students.updateMany({}, { $pull: { fees: { paid: true } } })               // remove all paid fee records
db.shoppingCart.updateOne({ cartId: 561 }, { $pull: { cart: "item1", spentAmounts: { $gt: 400 } } })
```

**`$pullAll`**

```javascript
db.students.updateOne({ regno: "FA21-BSE-007" }, { $pullAll: { subjects: ["SE", "Maths"] } })
// equivalent to:
db.students.updateOne({ regno: "FA21-BSE-007" }, { $pull: { subjects: { $in: ["SE", "Maths"] } } })
```

### 7.8 The positional operator `$`

`$` stands for "the first element that matched the array condition in the filter". The array field **must** appear in the filter.

```javascript
// rename subject "DB" to "Databases" for one student
db.students.updateOne(
  { regno: "FA22-BCS-001", subjects: "DB" },
  { $set: { "subjects.$": "Databases" } }
)
```

**In arrays of embedded documents:**

```javascript
// mark Ali's February fee as paid
db.students.updateOne(
  { regno: "FA22-BCS-001", "fees.month": "Feb" },
  { $set: { "fees.$.paid": true } }
)
```

**With `$elemMatch`** when the element must match several conditions:

```javascript
db.students.updateOne(
  { regno: "FA22-BCS-001", fees: { $elemMatch: { month: "Jan", amount: 15000 } } },
  { $set: { "fees.$.amount": Int32(16000) } }
)
```

**All elements (`$[]`)** and **filtered elements (`$[x]` + `arrayFilters`)**:

```javascript
// mark every fee of every student as paid
db.students.updateMany({}, { $set: { "fees.$[].paid": true } })

// raise only fees below 16000 to 16000
db.students.updateMany(
  {},
  { $set: { "fees.$[f].amount": Int32(16000) } },
  { arrayFilters: [ { "f.amount": { $lt: 16000 } } ] }
)
```

### 7.9 Find-and-modify helpers

These update a document **and return it** in one step:

```javascript
db.students.findOneAndUpdate(
  { regno: "FA22-BCS-001" },
  { $inc: { marks: Int32(1) } },
  { returnDocument: "after" }      // return the updated version
)
db.students.findOneAndReplace({ regno: "X" }, { name: "Y" })
db.students.findOneAndDelete({ regno: "X" })
```

### Summary

- Methods: `updateOne()`, `updateMany()`, `replaceOne()` (legacy: `update()` with `{ multi: true }`).
- Field operators: `$set`, `$unset`, `$rename`, `$inc`, `$mul`, `$min`, `$max`, `$currentDate`.
- Array operators: `$push` (+ `$each`), `$addToSet`, `$pop`, `$pull`, `$pullAll`.
- Positional `$` (with dot notation or `$elemMatch`), `$[]` and `$[x]` with `arrayFilters`.
- `upsert: true` inserts when nothing matches.

---

## 8. Delete

You can delete **documents**, **collections**, and **databases**.

### 8.1 Deleting documents

| Method | Deletes | Returns |
|--------|---------|---------|
| `deleteOne(filter)` | first matching document | `{ acknowledged, deletedCount }` |
| `deleteMany(filter)` | all matching documents | `{ acknowledged, deletedCount }` |
| `remove(filter)` | **Legacy**, all matches | `WriteResult({ nRemoved })` |
| `remove(filter, true)` | **Legacy**, one match | `WriteResult({ nRemoved: 1 })` |

```javascript
db.students.deleteOne({ regno: "FA24-BCS-100" })
// { acknowledged: true, deletedCount: 1 }

db.students.deleteMany({ class: "BSSE-8" })
// { acknowledged: true, deletedCount: 1 }

db.students.deleteMany({ marks: { $lt: 50 } })
```

> **CAUTION:** `deleteMany({})` (legacy `remove({})`) deletes **every document** in the collection. Run the same filter with `find()` first to see what will be removed:
>
> ```javascript
> db.students.find({ marks: { $lt: 50 } })        // check
> db.students.deleteMany({ marks: { $lt: 50 } })  // then delete
> ```

**Legacy:**

```javascript
db.students.remove({ class: "BSSE-8" })         // WriteResult({ "nRemoved" : 5 })
db.students.remove({ class: "BSSE-8" }, true)   // WriteResult({ "nRemoved" : 1 })
```

### 8.2 Deleting a collection: `drop()`

Removes the collection, all its documents **and its indexes**:

```javascript
db.teachers.drop()
// true
```

`deleteMany({})` empties a collection but keeps the collection and its indexes; `drop()` removes everything.

### 8.3 Deleting a database: `dropDatabase()`

```javascript
use testDb
db.dropDatabase()
// { ok: 1, dropped: "testDb" }
```

Always run `db` first to confirm which database is active.

### Summary

- Documents: `deleteOne()`, `deleteMany()` (legacy: `remove()`).
- Collection: `drop()`.
- Database: `dropDatabase()`.

---

## 9. Aggregation

### 9.1 The aggregation pipeline

Aggregation processes documents through a sequence of **stages**. Each stage takes documents in, transforms them, and passes the output to the next stage.

```
All documents ──► $match ──► subset ──► $group ──► new summary documents
```

```javascript
db.<collection>.aggregate([
  <stage1>,
  <stage2>,
  ...
  <stageN>
], <options>)
```

> `aggregate()` returns a **cursor**, just like `find()`.

### 9.2 Stage syntax and expressions

Every stage is an object whose key is a **stage operator**:

```javascript
{ $match: { age: { $gt: 20 } } }
{ $group: { _id: "$age" } }
{ $sort:  { count: -1 } }
```

**Expressions:** inside a stage, `"$fieldName"` (a string starting with `$`) means "the value of this field in the input document":

```javascript
"$age"                     // value of age
"$guardian.address.city"   // value of a nested field
```

Stages covered: `$match`, `$group`, `$project`, `$sort`, `$count`, `$limit`, `$skip`, `$unwind`, `$out` (plus `$lookup` and `$addFields` as extras).

### 9.3 `$match`: filter documents

Uses exactly the same query language as `find()`, all operators included:

```javascript
{ $match: { <query> } }
```

```javascript
db.students.aggregate([ { $match: { age: { $gt: 20 } } } ])

db.students.aggregate([
  { $match: { $and: [ { city: "Lahore" }, { marks: { $gt: 75 } } ] } }
])
```

Put `$match` **as early as possible**: it reduces the documents later stages have to process, and at the start of the pipeline it can use indexes.

### 9.4 `$group`: group documents

```javascript
{ $group: { _id: <expression>, <field1>: { <accumulator1>: <expression1> }, ... } }
```

`_id` is **mandatory**. It defines what you group by.

**Group by one field** (gives the distinct values):

```javascript
db.students.aggregate([ { $group: { _id: "$class" } } ])
// { _id: "BSCS-4" }
// { _id: "BSCS-2" }
// { _id: "BSSE-6" }
// { _id: "BSSE-8" }
```

**Group by a nested field:**

```javascript
db.students.aggregate([ { $group: { _id: "$guardian.address.city" } } ])
```

**Group by several fields:**

```javascript
db.students.aggregate([ { $group: { _id: { class: "$class", city: "$city" } } } ])
// { _id: { class: "BSCS-4", city: "Lahore" } }
// { _id: { class: "BSCS-2", city: "Karachi" } }
// ...
```

**Group everything into one result** with `_id: null`:

```javascript
db.students.aggregate([ { $group: { _id: null, avgMarks: { $avg: "$marks" } } } ])
```

### 9.5 Stage order matters

**`$match` then `$group`** (correct):

```javascript
db.students.aggregate([
  { $match: { city: "Lahore" } },
  { $group: { _id: { age: "$age", class: "$class" } } }
])
```

**`$group` then `$match` on an original field** (wrong order, returns **nothing**):

```javascript
db.students.aggregate([
  { $group: { _id: { age: "$age", class: "$class" } } },
  { $match: { city: "Lahore" } }      // documents after $group have no "city" field
])
// EMPTY
```

After `$group`, the documents only contain `_id` (and any accumulator fields). A `$match` after `$group` must use those fields:

```javascript
db.students.aggregate([
  { $group: { _id: { age: "$age", class: "$class" } } },
  { $match: { "_id.age": { $gt: 20 } } }
])
```

### 9.6 `$count`

Counts the documents reaching this stage and outputs one document:

```javascript
{ $count: "<outputFieldName>" }
```

```javascript
db.students.aggregate([ { $count: "totalStudents" } ])
// { totalStudents: 6 }

// how many different classes?
db.students.aggregate([
  { $group: { _id: "$class" } },
  { $count: "classCount" }
])
// { classCount: 4 }
```

**Different ways to count** (timed on 1000 documents):

| Command | Where counting happens | Speed |
|---------|------------------------|-------|
| `db.persons.aggregate([{ $count: "total" }])` | server | fast (0.21 s) |
| `db.persons.countDocuments({})` (legacy `find({}).count()`) | server (wraps an aggregation) | fast (0.21 s) |
| `db.persons.aggregate([]).itcount()` | client: downloads all docs | slow (1.4 s) |
| `db.persons.aggregate([]).toArray().length` | client: downloads all docs | slow (1.7 s) |

Count on the server whenever you can.

### 9.7 `$sort`

```javascript
{ $sort: { <field1>: 1 | -1, <field2>: 1 | -1, ... } }     // 1 ascending, -1 descending
```

```javascript
db.students.aggregate([ { $sort: { name: 1 } } ])

db.students.aggregate([
  { $group: { _id: "$city" } },
  { $sort: { _id: 1 } }
])
// { _id: "Islamabad" } { _id: "Karachi" } { _id: "Lahore" } { _id: "Multan" }
```

### 9.8 `$project`

Include, exclude, rename or compute fields:

```javascript
{ $project: { <field1>: 1, <field2>: 0, <newField>: <expression>, ... } }
```

```javascript
db.students.aggregate([ { $project: { name: 1, "guardian.address.city": 1 } } ])
db.students.aggregate([ { $project: { _id: 0, name: 1, age: 1 } } ])
db.students.aggregate([ { $project: { fees: 0, guardian: 0 } } ])
db.students.aggregate([ { $project: { name: 1, studentAge: "$age" } } ])   // renamed field
```

Building new nested fields:

```javascript
db.students.aggregate([
  { $project: {
      _id: 0,
      name: 1,
      info: {
        cls:  "$class",
        city: "$city",
        guardianCity: "$guardian.address.city"
      }
  } }
])
// { name: "Ali Khan", info: { cls: "BSCS-4", city: "Lahore", guardianCity: "Lahore" } }
```

`$addFields` (alias `$set`) is like `$project` but **keeps all existing fields** and adds new ones:

```javascript
db.students.aggregate([ { $addFields: { subjectCount: { $size: "$subjects" } } } ])
```

### 9.9 `$limit` and `$skip`

```javascript
{ $limit: <number> }
{ $skip:  <number> }
```

`$limit` is typically used:

1. As the **first** stage, to experiment on a sample.
2. **After `$sort`**, to get top-N results.

```javascript
// top 3 students by marks
db.students.aggregate([
  { $sort: { marks: -1 } },
  { $limit: 3 },
  { $project: { _id: 0, name: 1, marks: 1 } }
])

// sample run on the first 100 documents
db.persons.aggregate([
  { $limit: 100 },
  { $match: { age: { $gt: 27 } } },
  { $group: { _id: "$company.location.country" } }
])
```

### 9.10 `$unwind`

Splits a document with an array into **one document per array element**:

```javascript
{ $unwind: "<$arrayField>" }
```

```
Input:   { name: "Ali", subjects: ["DB", "OOP", "Maths"] }
           ↓  $unwind: "$subjects"
Output:  { name: "Ali", subjects: "DB" }
         { name: "Ali", subjects: "OOP" }
         { name: "Ali", subjects: "Maths" }
```

```javascript
db.students.aggregate([
  { $unwind: "$subjects" },
  { $project: { _id: 0, name: 1, subjects: 1 } }
])

// list of all distinct subjects offered
db.students.aggregate([
  { $unwind: "$subjects" },
  { $group: { _id: "$subjects" } }
])
```

Documents whose array is empty or missing are **dropped** by `$unwind`. To keep them: `{ $unwind: { path: "$fees", preserveNullAndEmptyArrays: true } }`.

### 9.11 Accumulators

Accumulators keep a running value **per group**. Most are used inside `$group`.

```javascript
{ $<accumulator>: <expression> }
```

| Accumulator | Result per group |
|-------------|------------------|
| `$sum` | sum of values (or count, with `$sum: 1`) |
| `$avg` | average |
| `$min` / `$max` | smallest / largest value |
| `$first` / `$last` | value from the first / last document (use after `$sort`) |
| `$push` | array of all values |
| `$addToSet` | array of distinct values |

How `$sum` works:

```
Group (age 25):  quantity 10, 5, 30, 45   →   total = 10 + 5 + 30 + 45 = 90
```

**`$sum`**

```javascript
// number of students per class  ($sum: 1 adds 1 for every document)
db.students.aggregate([
  { $group: { _id: "$class", count: { $sum: 1 } } }
])
// { _id: "BSCS-4", count: 2 }
// { _id: "BSCS-2", count: 2 } ...

// how many students take each subject
db.students.aggregate([
  { $unwind: "$subjects" },
  { $group: { _id: "$subjects", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
// { _id: "DB", count: 4 } ...

// total fees billed per student
db.students.aggregate([
  { $unwind: "$fees" },
  { $group: { _id: "$name", totalFees: { $sum: "$fees.amount" } } }
])
```

**`$avg`, `$min`, `$max`**

```javascript
db.students.aggregate([
  { $group: {
      _id: "$class",
      avgMarks: { $avg: "$marks" },
      minMarks: { $min: "$marks" },
      maxMarks: { $max: "$marks" },
      students: { $push: "$name" }
  } },
  { $sort: { avgMarks: -1 } }
])
// { _id: "BSCS-4", avgMarks: 81.5, minMarks: 78, maxMarks: 85, students: ["Ali Khan", "Ayesha Malik"] } ...
```

### 9.12 Expression ("unary") operators

Sometimes called **unary operators**, these are operators like `$type`, `$multiply`, `$gt`, `$and`, `$or` used as **expressions** that compute a value per document.

- They are usually used in `$project` (or `$addFields`).
- In `$group`, they can only be used **inside an accumulator**, e.g. `{ $sum: { $multiply: [...] } }`.

**`$type`**: returns the BSON type name of a value.

```javascript
db.students.aggregate([
  { $project: { name: 1, marksType: { $type: "$marks" }, ageType: { $type: "$age" } } }
])
// { _id: ..., name: "Ali Khan", marksType: "int", ageType: "double" }
```

**Arithmetic and comparison expressions:**

```javascript
db.students.aggregate([
  { $project: {
      _id: 0,
      name: 1,
      outOf150:   { $multiply: [ { $divide: ["$marks", 100] }, 150 ] },  // rescale marks to 150
      passed:     { $gte: ["$marks", 60] },                           // true / false
      honours:    { $and: [ { $gte: ["$marks", 80] }, { $lt: ["$age", 22] } ] },
      grade: { $cond: { if: { $gte: ["$marks", 80] }, then: "A", else: "B or lower" } }
  } }
])
```

Note the difference: as a **query** operator you write `{ marks: { $gte: 60 } }`; as an **expression** you write `{ $gte: ["$marks", 60] }`.

Inside `$group` with an accumulator:

```javascript
// total revenue per month across all students
db.students.aggregate([
  { $unwind: "$fees" },
  { $group: { _id: "$fees.month", collected: { $sum: { $cond: ["$fees.paid", "$fees.amount", 0] } } } }
])
```

### 9.13 `$out`: write results to a collection

```javascript
{ $out: "<outputCollection>" }
```

- `$out` **must be the last stage**.
- If the output collection doesn't exist, it is created. If it exists, it is **replaced**.

```javascript
db.students.aggregate([
  { $group: { _id: "$class", count: { $sum: 1 }, avgMarks: { $avg: "$marks" } } },
  { $out: "classSummary" }
])
db.classSummary.find()
```

`$merge` is the modern alternative that can **merge into** an existing collection instead of replacing it.

### 9.14 `$lookup`: joining collections (extra)

```javascript
db.classes.insertMany([
  { _id: "BSCS-4", advisor: "Dr. Naveed", room: "C-12" },
  { _id: "BSCS-2", advisor: "Dr. Saima",  room: "C-05" }
])

db.students.aggregate([
  { $lookup: { from: "classes", localField: "class", foreignField: "_id", as: "classInfo" } },
  { $project: { _id: 0, name: 1, class: 1, "classInfo.advisor": 1 } }
])
```

### 9.15 `allowDiskUse`

Each stage may use at most **100 MB of RAM**. If it needs more (e.g. a big `$sort` or `$group`), older servers return an error unless you allow temporary files on disk:

```javascript
db.students.aggregate([ /* stages */ ], { allowDiskUse: true })
```

Since MongoDB 6.0, disk use is allowed by default (`allowDiskUseByDefault`), but the option is still accepted.

### Summary

- `aggregate([stages])` returns a cursor; stages run in order.
- Stages: `$match`, `$group`, `$project`, `$sort`, `$count`, `$limit`, `$skip`, `$unwind`, `$out` (+ `$addFields`, `$lookup`, `$merge`).
- `"$field"` refers to an input field's value.
- Accumulators: `$sum`, `$avg`, `$min`, `$max`, `$push`, `$addToSet`, `$first`, `$last`.
- Expression operators (`$type`, `$multiply`, `$gte`, `$cond` ...) compute values in `$project`, or inside accumulators in `$group`.

---

## 10. Indexes

### 10.1 Why indexes

- Without an index, MongoDB must scan **every document** in the collection: a **COLLSCAN**.
- An index stores the values of one or more fields **in sorted order**, with pointers to the documents.
- With a suitable index, MongoDB scans only the index: an **IXSCAN**, then fetches just the matching documents.

```
Documents:  { age: 22 }  { age: 25 }  { age: 19 }  { age: 27 } ...
Index { age: 1 }:   19 → 22 → 25 → 27   (sorted, each pointing to its document)
```

MongoDB indexes are **B-tree** structures:

```
              25
           /      \
         22        27
       /    \     /    \
     19     23  26     30, 35
```

- Query `{ age: 25 }`: walk the tree straight to 25.
- Query `{ age: { $lte: 22 } }`: start at the minimum and read up to 22.

The trade-off: indexes speed up reads but take disk/RAM and slow down writes slightly (every insert/update must update the index too).

### 10.2 The default `_id` index

- Every collection automatically has an index on `{ _id: 1 }`.
- Its name is `_id_`.
- It is **unique** and cannot be dropped.

### 10.3 Listing indexes: `getIndexes()`

```javascript
db.students.getIndexes()
```

```javascript
[ { v: 2, key: { _id: 1 }, name: "_id_" } ]
```

(Older servers also show an `ns: "myDb.persons"` field.)

### 10.4 Creating indexes: `createIndex()`

```javascript
db.<collection>.createIndex( { <field>: 1 | -1 }, <options> )
```

`1` = ascending, `-1` = descending (for a single-field index both work equally well for queries and sorts).

```javascript
db.students.createIndex({ age: 1 })
db.students.createIndex({ name: 1 })
```

Result:

```javascript
"age_1"     // mongosh prints the name of the new index
```

The automatic name is `<field>_<direction>`, e.g. `age_1`, `name_1`.

### 10.5 Index options

| Option | Meaning |
|--------|---------|
| `{ unique: true }` | no two documents may have the same value |
| `{ name: "<indexName>" }` | custom name |
| `{ background: true }` | (legacy) build without blocking other operations. **Ignored since MongoDB 4.2**, where all builds use an optimized process that only locks briefly at the start and end. |
| `{ sparse: true }` | only index documents that have the field |
| `{ expireAfterSeconds: N }` | TTL index: delete documents N seconds after a date field |
| `{ partialFilterExpression: {...} }` | index only documents matching a filter |

**Unique index**: perfect for `regno`:

```javascript
db.students.createIndex({ regno: 1 }, { unique: true })

db.students.insertOne({ name: "Duplicate", regno: "FA22-BCS-001" })
// MongoServerError: E11000 duplicate key error collection: school.students index: regno_1 dup key: { regno: "FA22-BCS-001" }
```

> If the collection already has several documents **without** `regno` (for example the "Auto Id" documents inserted in the CRUD chapter), the unique index fails to build, because a missing field counts as `null` and `null` appears more than once. Delete those documents, reset the sample data, or add `partialFilterExpression: { regno: { $exists: true } }` to the options.

**Custom name:**

```javascript
db.students.createIndex({ marks: -1 }, { name: "marksDescIndex" })
```

**Background (legacy):**

```javascript
db.students.createIndex({ city: 1 }, { background: true })   // accepted, but the option has no effect on 4.2+
```

**Compound index**: one index on several fields, useful when you filter on one field and sort on another:

```javascript
db.students.createIndex({ class: 1, marks: -1 })
db.students.find({ class: "BSCS-4" }).sort({ marks: -1 })   // fully served by the index
```

### 10.6 Analyzing query performance: `explain()`

```javascript
db.<collection>.explain().<method>(...)
db.<collection>.explain("executionStats").<method>(...)
// or on a cursor:
db.<collection>.find(...).explain("executionStats")
```

```javascript
db.students.explain().find({ age: { $gt: 20 } })
db.students.explain("executionStats").find({ age: { $gt: 20 } })
db.students.explain().aggregate([ { $group: { _id: "$city" } } ])
```

**What to look for:**

| Field | Meaning |
|-------|---------|
| `queryPlanner.winningPlan.stage` | `COLLSCAN` (no index), `IXSCAN` (index scan), `FETCH` (load documents after an index scan) |
| `winningPlan.inputStage.keyPattern` | which index was used |
| `executionStats.nReturned` | documents returned |
| `executionStats.totalKeysExamined` | index entries read |
| `executionStats.totalDocsExamined` | documents read |
| `executionStats.executionTimeMillis` | time taken |

**With an index** (`find({ age: { $gt: 25 } })`, index on `age`):

```javascript
winningPlan: { stage: "FETCH", inputStage: { stage: "IXSCAN", keyPattern: { age: 1 } } }
executionStats: { nReturned: 258, totalKeysExamined: 258, totalDocsExamined: 258 }
```

Ideal: keys examined ≈ docs examined ≈ documents returned.

**Without an index** (`find({ gender: "female" })`):

```javascript
winningPlan: { stage: "COLLSCAN", filter: { gender: { $eq: "female" } } }
executionStats: { nReturned: 507, totalKeysExamined: 0, totalDocsExamined: 1000 }
```

All 1000 documents were read to return 507.

**With an unanchored regex** (`find({ name: /el/i })`, index on `name`):

```javascript
executionStats: { nReturned: 148, totalKeysExamined: 1000, totalDocsExamined: 148 }
```

The index is used, but every key (1000) had to be checked, because `/el/i` can match anywhere in the string. A prefix regex like `/^El/` would examine far fewer keys.

Try it on your data:

```javascript
db.students.dropIndexes()
db.students.find({ city: "Lahore" }).explain("executionStats").executionStats
db.students.createIndex({ city: 1 })
db.students.find({ city: "Lahore" }).explain("executionStats").executionStats
```

### 10.7 Deleting indexes

```javascript
db.students.dropIndex({ age: 1 })        // by key pattern
db.students.dropIndex("marksDescIndex")  // by name
db.students.dropIndexes()                // all indexes except _id_
```

### Summary

- Indexes turn COLLSCANs into IXSCANs; they are B-trees of sorted values.
- `_id_` exists by default and is unique.
- `getIndexes()`, `createIndex()` (options `unique`, `name`, legacy `background`), `dropIndex()`, `dropIndexes()`.
- `explain("executionStats")` shows the plan and how many keys/documents were examined.

---

## 11. Utilities

These command-line tools are part of **MongoDB Database Tools** (a separate download since 4.4). They run in your **operating system terminal**, not inside mongosh.

| Tool | Purpose |
|------|---------|
| `mongoexport` | export a collection to JSON or CSV |
| `mongoimport` | import JSON or CSV into a collection |
| `mongodump` | binary (BSON) backup of databases |
| `mongorestore` | restore a `mongodump` backup |
| `mongostat` | live server statistics, refreshed every second |
| `mongotop` | live read/write time per collection |

**Connection options** (shared by all tools):

```bash
--uri "mongodb://user:pass@host:27017/?authSource=admin"
# or separate options:
--host <hostname> --port 27017 --username <user> --password <pass> --authenticationDatabase <authDb>
```

> Security tip: leave out `--password` (or its value) and the tool will prompt for it, so it doesn't end up in your shell history.

### 11.1 mongoexport

Exports data as JSON (in **Strict/Relaxed Extended JSON**, one document per line) or CSV.

```bash
mongoexport --db school --collection students --out students.json
mongoexport --db school --collection students --jsonArray --pretty --out students.json   # one JSON array
mongoexport --db school --collection students --type=csv --fields name,age,class,regno --out students.csv
mongoexport --db school --collection students --query '{"class":"BSCS-4"}' --out bscs4.json
```

Remote server:

```bash
mongoexport --host <hostname> --username admin --password <password> --authenticationDatabase admin \
            --db myDb --collection persons --out persons.json
```

`--jsonArray` exports the data as a single array of JSON objects instead of one object per line.

### 11.2 mongoimport

Imports JSON (Strict or Shell mode Extended JSON) or CSV.

```bash
mongoimport --db school --collection studentsImport --file students.json
mongoimport --db school --collection studentsImport --file students.json --jsonArray     # file is an array
mongoimport --db school --collection studentsImport --type=csv --headerline --file students.csv
mongoimport --db school --collection studentsImport --file students.json --drop          # drop the collection first
mongoimport --db school --collection students --file new.json --mode=upsert --upsertFields=regno
```

> **Note:** importing a document whose value violates a **unique index** (for example the same `_id` or `regno`) produces a duplicate key error for that document.

### 11.3 mongodump

Binary (BSON) backup. Faster and more type-accurate than mongoexport. Without `--db`, all databases except `local` are dumped.

```bash
mongodump                                   # everything, into ./dump/
mongodump --db school                       # one database
mongodump --db school --collection students --out ./backup
mongodump --db school --archive=school.archive --gzip   # single compressed file
```

Remote:

```bash
mongodump --host <hostname> --username admin --password <password> --authenticationDatabase admin --db myDb --out ./backup
```

### 11.4 mongorestore

Restores a mongodump backup. **Indexes are recreated** from the dump.

```bash
mongorestore                                        # restores ./dump/
mongorestore --dir ./backup
mongorestore --drop --dir ./backup                  # drop existing collections first
mongorestore --nsInclude="school.students" --dir ./backup
mongorestore --archive=school.archive --gzip        # from a compressed archive
mongorestore --archive=school.archive --gzip --nsFrom="school.*" --nsTo="schoolCopy.*"   # restore under a new name
```

### 11.5 mongostat

Real-time statistics, one line per second:

```bash
mongostat
mongostat --uri "mongodb://admin@host:27017/?authSource=admin"
mongostat 5          # refresh every 5 seconds
```

```
insert query update delete getmore command dirty used flushes vsize  res  qrw arw net_in net_out conn time
    *0    *0     *0     *0       0     7|0  0.0% 1.0%       0 1.03G 102M 0|0 1|0  1.18k   66.1k   10 Apr 30 12:41:53
```

| Column | Meaning |
|--------|---------|
| insert / query / update / delete | operations per second |
| command | commands per second (local\|replicated) |
| dirty / used | % of the WiredTiger cache that is dirty / used |
| vsize / res | virtual / resident memory |
| qrw / arw | queued / active read\|write clients |
| net_in / net_out | network traffic |
| conn | open connections |

### 11.6 mongotop

Shows how much time `mongod` spends reading and writing each collection:

```bash
mongotop             # refresh every second
mongotop 180         # refresh every 180 seconds
mongotop --uri "mongodb://admin@host:27017/?authSource=admin"
```

```
ns                  total   read   write
school.students       4ms    4ms     0ms
admin.system.roles    0ms    0ms     0ms
local.startup_log     0ms    0ms     0ms
```

### Summary

- `mongoexport` / `mongoimport`: JSON or CSV, human-readable, good for data exchange.
- `mongodump` / `mongorestore`: binary BSON, good for backups; supports `--archive` and `--gzip`; indexes restored.
- `mongostat`: server-wide stats per second; `mongotop`: time per collection.

---

## 12. Legacy shell vs mongosh cheat sheet

| Task | Legacy `mongo` shell | `mongosh` (use this) |
|------|-------------------------------|----------------------|
| Start shell | `mongo` | `mongosh` |
| Shell version | `mongo --version` | `mongosh --version` |
| JS engine | `interpreterVersion()` (SpiderMonkey) | Node.js |
| Insert | `insert(doc)` / `insert([docs])` | `insertOne(doc)` / `insertMany([docs])` |
| Update one | `update(q, u)` | `updateOne(q, u)` |
| Update many | `update(q, u, { multi: true })` | `updateMany(q, u)` |
| Replace | `update(q, wholeDoc)` | `replaceOne(q, wholeDoc)` |
| Delete all matches | `remove(q)` | `deleteMany(q)` |
| Delete one | `remove(q, true)` | `deleteOne(q)` |
| Count | `find(q).count()` / `count()` | `countDocuments(q)` / `estimatedDocumentCount()` |
| 32-bit int | `NumberInt(5)` | `Int32(5)` (or `NumberInt(5)`) |
| 64-bit int | `NumberLong(5)` | `Long(5)` (or `NumberLong(5)`) |
| Shell batch size | `DBQuery.shellBatchSize = 50` | `config.set("displayBatchSize", 50)` |
| Background index | `{ background: true }` | not needed (ignored since 4.2) |
| Result objects | `WriteResult({ nMatched, nModified })` | `{ matchedCount, modifiedCount }` |

---

## 13. Practice exercises

Try these on `school.students` after resetting the sample data (`db.students.drop()` and re-running the insert block at the top). Answers follow.

1. Show only `name` and `regno` of all students in `BSCS-4`, without `_id`.
2. Find students aged between 20 and 22 (inclusive) from Lahore or Karachi.
3. Find students who take **both** "DB" and "Maths".
4. Find students who have an unpaid fee for January.
5. Count students whose name starts with "A".
6. Add the subject "Ethics" to every BSCS student, without creating duplicates.
7. Increase marks of all BSSE students by 5, keeping the integer type.
8. Remove the `fees` field from students who have no fee records.
9. Show the average marks per city, highest first.
10. Show the 2 most popular subjects with their student counts.
11. Create a unique index on `regno` and check that `find({ regno: "FA22-BCS-001" })` uses it.
12. Export `BSCS-2` students to a CSV file with name, age and regno.

<details>
<summary>Answers</summary>

```javascript
// 1
db.students.find({ class: "BSCS-4" }, { _id: 0, name: 1, regno: 1 })

// 2
db.students.find({ age: { $gte: 20, $lte: 22 }, city: { $in: ["Lahore", "Karachi"] } })

// 3
db.students.find({ subjects: { $all: ["DB", "Maths"] } })

// 4
db.students.find({ fees: { $elemMatch: { month: "Jan", paid: false } } })

// 5
db.students.countDocuments({ name: /^A/ })

// 6
db.students.updateMany({ class: /^BSCS/ }, { $addToSet: { subjects: "Ethics" } })

// 7
db.students.updateMany({ class: /^BSSE/ }, { $inc: { marks: Int32(5) } })

// 8
db.students.updateMany({ fees: { $size: 0 } }, { $unset: { fees: 1 } })

// 9
db.students.aggregate([
  { $group: { _id: "$city", avgMarks: { $avg: "$marks" } } },
  { $sort: { avgMarks: -1 } }
])

// 10
db.students.aggregate([
  { $unwind: "$subjects" },
  { $group: { _id: "$subjects", students: { $sum: 1 } } },
  { $sort: { students: -1 } },
  { $limit: 2 }
])

// 11
db.students.createIndex({ regno: 1 }, { unique: true })
db.students.find({ regno: "FA22-BCS-001" }).explain().queryPlanner.winningPlan
// look for stage: "IXSCAN" with keyPattern { regno: 1 }
```

```bash
# 12 (in the OS terminal, not mongosh)
mongoexport --db school --collection students --query '{"class":"BSCS-2"}' \
            --type=csv --fields name,age,regno --out bscs2.csv
```

</details>

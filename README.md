# Relations and Aggregation with Mongoose: the recapsheet database

In this lab you load a small marks database (students, assessment heads and the marks each student got), link the collections together with Mongoose references and `populate()`, and then do the same joins inside MongoDB with the aggregation pipeline and `$lookup`.

This lab continues from the [MongoDB Lab Setup](../mongodb-lab-setup/mongodb-lab-setup.md) tutorial. You need the `mongo-db` container running on your Debian VM, and Node.js on your Windows 11 host.

---

## Contents

- [The recapsheet data](#the-recapsheet-data)
- [Part A: Load the data (Debian VM)](#part-a-load-the-data-debian-vm)
  - [Step 1: Download the JSON folder](#step-1-download-the-json-folder)
  - [Step 2: Load the recapsheet database](#step-2-load-the-recapsheet-database)
- [Part B: Initial setup (Windows 11)](#part-b-initial-setup-windows-11)
  - [Step 3: Create the project](#step-3-create-the-project)
  - [Step 4: Generate models.js for recapsheet](#step-4-generate-modelsjs-for-recapsheet)
  - [Step 5: Create REPL.js](#step-5-create-repljs)
  - [Step 6: Run a first query](#step-6-run-a-first-query)
- [Part C: Relations with populate()](#part-c-relations-with-populate)
  - [Step 7: One-to-one, Mark to Student](#step-7-one-to-one-mark-to-student)
  - [Step 8: One-to-one, Mark to Head](#step-8-one-to-one-mark-to-head)
  - [Step 9: One-to-many, Student to Marks](#step-9-one-to-many-student-to-marks)
- [Part D: Joins with the aggregation pipeline](#part-d-joins-with-the-aggregation-pipeline)
  - [Step 10: Aggregation with $lookup](#step-10-aggregation-with-lookup)
  - [Step 11: Aggregation with total marks obtained](#step-11-aggregation-with-total-marks-obtained)
  - [Step 12: Aggregation with a $lookup pipeline](#step-12-aggregation-with-a-lookup-pipeline)
- [populate() or $lookup?](#populate-or-lookup)
- [Reset the database](#reset-the-database)
- [Troubleshooting](#troubleshooting)
- [Changes from the original code](#changes-from-the-original-code)

---

## The recapsheet data

The `recapsheet` database has four collections:

| Collection | Documents | Fields | Example |
|---|---|---|---|
| `students` | 38 | `regno`, `name` | `{ regno: "1712218", name: "Aadesh Kumar" }` |
| `heads` | 8 | `hid`, `headname`, `total` | `{ hid: 1, headname: "Quiz 1", total: 5 }` |
| `marks` | 304 | `mid`, `regno`, `hid`, `marks` | `{ mid: 1, regno: "1712218", hid: 1, marks: 4.25 }` |
| `grades` | 11 | `gradeid`, `start`, `end`, `grade`, `gpa` | `{ gradeid: 1, start: 95, end: 100, grade: "A+", gpa: 4 }` |

A **head** is one assessment: Quiz 1, Quiz 2, Assig. 1, Assig. 2, Final 1, Mid Term 1, Project 1 and CP 1. Their `total` values add up to 100, so a student's total marks is also their percentage.

Each **mark** document records what one student got in one head. It points to the student with `regno` and to the head with `hid`, exactly like foreign keys in a relational table:

```
students                marks                          heads
+---------+------+      +-----+---------+-----+-------+      +-----+----------+-------+
| regno   | name |<-----| mid | regno   | hid | marks |----->| hid | headname | total |
+---------+------+      +-----+---------+-----+-------+      +-----+----------+-------+
```

Every student has exactly 8 marks (one per head), so 38 × 8 = 304 mark documents.

MongoDB does not enforce these links. `regno` and `hid` are ordinary values, and nothing stops a mark from pointing to a student that does not exist. In this lab you join on them in two ways:

1. **Mongoose references and `populate()`** (Part C): store the other document's `_id` in a field, then let Mongoose fetch it for you.
2. **The aggregation pipeline and `$lookup`** (Part D): ask MongoDB to join the collections on `regno` and `hid` directly.

---

## Part A: Load the data (Debian VM)

Run these steps on the **Debian VM**, inside the `~/mongodb` folder from the setup lab:

```bash
cd ~/mongodb
```

### Step 1: Download the JSON folder

```bash
npx degit asimriaz/Advance-DBMS-Fall-2026/JSON#NoSQL JSON
```

| Part | Meaning |
|---|---|
| `npx degit` | Runs the `degit` tool without installing it. degit copies files from a GitHub repository without its git history. |
| `asimriaz/Advance-DBMS-Fall-2026/JSON` | The repository, followed by the folder inside it to copy (`JSON`). |
| `#NoSQL` | The branch to copy from. |
| `JSON` (last word) | The local folder to create. |

Your folder now contains:

```
JSON
├── courses.json
├── persons.json
└── recapsheet
    ├── README.md
    ├── grades.json
    ├── heads.json
    ├── marks.json
    └── students.json
```

> **No Node.js on the VM?** `npx` comes with Node.js. If the VM does not have it, download the four files with `wget` instead:
>
> ```bash
> mkdir -p JSON/recapsheet
> for c in grades heads marks students; do
>   wget -q -P JSON/recapsheet \
>     https://raw.githubusercontent.com/asimriaz/Advance-DBMS-Fall-2026/refs/heads/NoSQL/JSON/recapsheet/$c.json
> done
> ```

---

### Step 2: Load the recapsheet database

```bash
for f in JSON/recapsheet/*.json; do
  docker exec -i mongo-db mongoimport --jsonArray --drop \
    -d recapsheet -c "$(basename "${f%.json}")" < "$f"
done
```

The loop runs once for each `.json` file in `JSON/recapsheet`:

| Part | Meaning |
|---|---|
| `for f in JSON/recapsheet/*.json` | `f` takes the value `JSON/recapsheet/grades.json`, then `heads.json`, and so on. |
| `docker exec -i mongo-db` | Runs a command inside the `mongo-db` container. `-i` keeps standard input open so the file can be piped in. |
| `mongoimport --jsonArray` | Imports documents; the file holds one JSON array. |
| `--drop` | Drops the collection first, so running the loop again gives you a clean copy instead of duplicates. |
| `-d recapsheet` | The target database. |
| `-c "$(basename "${f%.json}")"` | The collection name: `${f%.json}` removes `.json`, and `basename` removes the folder, so `JSON/recapsheet/marks.json` becomes `marks`. |
| `< "$f"` | Sends the file into `mongoimport` through standard input. The file is on the VM, not inside the container, so it has to be piped in. |

You should see four `document(s) imported successfully` lines: 11 grades, 8 heads, 304 marks and 38 students.

Check it in mongosh:

```bash
docker exec -it mongo-db mongosh recapsheet --eval "show collections"
```

```
grades
heads
marks
students
```

---

## Part B: Initial setup (Windows 11)

Run these steps on your **Windows 11** host.

### Step 3: Create the project

Create a new folder next to the one from the setup lab, so the `models.js` you make here does not replace the `academic` one:

```powershell
cd $HOME\Documents
mkdir recapsheet
cd recapsheet
npm init -y
npm pkg set type=module
npm install mongoose
curl.exe -O https://raw.githubusercontent.com/asimriaz/Advance-DBMS-Fall-2026/refs/heads/NoSQL/generate-models.js
```

These are the same commands as Steps 14 and 15 of the setup lab: create `package.json`, switch the project to ES modules (so `import` and top-level `await` work), install Mongoose and download the model generator.

---

### Step 4: Generate models.js for recapsheet

The generator reads its connection string from the `MONGO_URI` environment variable, so you do not need to edit the file this time. Replace `<Debian VM IP>` with your VM's address.

PowerShell:

```powershell
$env:MONGO_URI = "mongodb://<Debian VM IP>:27017/recapsheet"
node generate-models.js models.js
```

Command Prompt:

```bat
set MONGO_URI=mongodb://<Debian VM IP>:27017/recapsheet
node generate-models.js models.js
```

The new `models.js` has one model per collection:

```javascript
import mongoose from "mongoose";
const { Schema } = mongoose;

if (mongoose.connection.readyState !== 1) {
      await mongoose.connect("mongodb://192.168.10.128:27017/recapsheet");
}

const Grade = mongoose.model("Grade", new Schema({}, { strict: false }), "grades");
const Head = mongoose.model("Head", new Schema({}, { strict: false }), "heads");
const Mark = mongoose.model("Mark", new Schema({}, { strict: false }), "marks");
const Student = mongoose.model("Student", new Schema({}, { strict: false }), "students");

export const db = { Grade, Head, Mark, Student };
```

Each line says three things: the **model name** (`"Mark"`), the **schema** (`new Schema({}, { strict: false })`) and the **collection** it reads (`"marks"`).

The schemas are empty. `strict: false` lets every field in the documents through, which is enough for `find()`. In Part C you will add a few fields to these schemas by hand, because `populate()` only works on fields the schema describes.

> **Keep your edits.** Running `generate-models.js` again overwrites `models.js`. After Part C, regenerate only if you are ready to add the schema fields back.

---

### Step 5: Create REPL.js

Create `REPL.js` in the same folder:

```javascript
import util from "util";
import { db } from "./models.js";

function displayDocs(docs) {
  console.log(
    `[\n${docs
      .map(
        (doc) =>
          `  ${util.inspect(doc, { colors: true, breakLength: Infinity })}`,
      )
      .join(",\n")}\n]`,
  );
  process.exit();
}

// ---- Step code goes below this line ----
```

| Part | What it does |
|---|---|
| `import { db } from "./models.js"` | Loads the four models. Importing `models.js` also opens the connection to MongoDB. |
| `displayDocs(docs)` | Prints an array of documents with **one document per line**. `util.inspect` with `colors: true` colours strings, numbers and ObjectIds, and `breakLength: Infinity` stops it wrapping a document over several lines. |
| `process.exit()` | Ends the script. Mongoose keeps the connection open, so without it Node would never return to the prompt. |

From here on, each step gives you code to put **below the marker line**. Delete or comment out the previous step's code first, so only one step runs at a time.

Two ways of printing are used:

- `.then(displayDocs)`: one line per document; good for short documents.
- `.then((res) => console.log(JSON.stringify(res, null, 4)))`: fully expanded, 4-space indented JSON; good for nested documents. Follow it with `.then(() => process.exit())`.

---

### Step 6: Run a first query

Below the marker line, add:

```javascript
db.Mark.find({ regno: "1712218" }).sort({ mid: 1 }).then(displayDocs);
```

Run it:

```powershell
node REPL.js
```

```
[
  { _id: new ObjectId('6ade20222937eca7769e9130'), mid: 1, regno: '1712218', hid: 1, marks: 4.25 },
  { _id: new ObjectId('6ade20222937eca7769e9134'), mid: 2, regno: '1712218', hid: 2, marks: 4 },
  ...
  { _id: new ObjectId('6ade20222937eca7769e9138'), mid: 8, regno: '1712218', hid: 8, marks: 4 }
]
```

These are Aadesh Kumar's 8 marks. Your `_id` values will be different; MongoDB creates them during the import.

The mark knows the student only as `'1712218'` and the head only as `1`. To see the student's name or the head's title you would have to run a second query. The rest of this lab is about getting that information in one go.

---

## Part C: Relations with populate()

`populate()` is a Mongoose feature. If a field holds the `_id` of a document in another collection, and the schema says which model that `_id` belongs to (`ref`), then `.populate("field")` runs the second query for you and puts the whole document in place of the `_id`.

That needs two things the imported data does not have yet:

1. A field that holds an **ObjectId**. The marks only have `regno` and `hid`, so a one-time migration copies each student's and head's `_id` into the marks.
2. A **schema path with `ref`**, so Mongoose knows which model to look in.

### Step 7: One-to-one, Mark to Student

Every mark belongs to exactly one student, so from the mark's side this is a one-to-one link: one mark, one student. (From the student's side it is one-to-many, which is Step 9.)

#### 7a. Add the `student` field to the Mark schema

Open `models.js` and replace the `Mark` line with:

```javascript
const Mark = mongoose.model(
  "Mark",
  new Schema(
    {
      student: { type: Schema.Types.ObjectId, ref: "Student" },
    },
    { strict: false },
  ),
  "marks",
);
```

`type: Schema.Types.ObjectId` says the field holds an ObjectId, and `ref: "Student"` says it is the `_id` of a document of the `Student` model. `strict: false` is kept, so `mid`, `regno`, `hid` and `marks` still come through.

#### 7b. Run the migration once

Below the marker line in `REPL.js`:

```javascript
// One-time migration: link each Mark document to its Student.
// For every student, find all marks with the same regno and store the
// student's _id in the mark's `student` field. Once this field holds an
// ObjectId reference, .populate("student") can replace it with the
// full student document.

// Instead of updating each mark individually, updateMany updates all
// marks with the same regno in one operation, which is more efficient
// and reduces the number of database calls.

db.Student.find()
  .then(async (students) => {
    for (const student of students) {
      const result = await db.Mark.updateMany(
        { regno: student.regno },
        { $set: { student: student._id } },
      );
      console.log(student.regno, result.modifiedCount);
    }
  })
  .then(() => process.exit());
```

```powershell
node REPL.js
```

```
1712218 8
1712219 8
1712220 8
...
1712248 8
1712255 8
```

38 lines, one per student, each with `8`: eight marks were updated for every student.

How it works:

1. `db.Student.find()` reads all 38 students.
2. For each student, `updateMany({ regno: student.regno }, ...)` selects every mark with that `regno` (the filter) and `$set` writes `student: <that student's _id>` into all of them. That is 38 database calls instead of 304.
3. `for ... of` with `await` runs the updates one after another and waits for the last one before `process.exit()` closes the script.

Running it again does no harm. `$set` writes the same value, and the counts just show `0`. Once it has run, **delete or comment out the migration**.

#### 7c. Populate the student

Below the marker line:

```javascript
db.Mark.find({ regno: "1712218" })
  .sort({ mid: 1 })
  .populate("student")
  .then(displayDocs);
```

```
[
  { _id: new ObjectId('6ade...9130'), mid: 1, regno: '1712218', hid: 1, marks: 4.25, student: { _id: new ObjectId('6ade...04fd'), regno: '1712218', name: 'Aadesh Kumar' } },
  { _id: new ObjectId('6ade...9134'), mid: 2, regno: '1712218', hid: 2, marks: 4, student: { _id: new ObjectId('6ade...04fd'), regno: '1712218', name: 'Aadesh Kumar' } },
  ...
]
```

Remove `.populate("student")` and run it again: `student` is back to a bare `new ObjectId('...')`. The database stores only the ObjectId; Mongoose fetched the student with a second query and swapped it in.

> **Why `.sort({ mid: 1 })`?** Without a sort, MongoDB returns documents in whatever order is cheapest to read. After an update that order can change, so always sort when the order matters.

---

### Step 8: One-to-one, Mark to Head

Same idea: every mark is for exactly one head.

#### 8a. Add the `head` field to the Mark schema

In `models.js`, add a `head` line under `student`:

```javascript
const Mark = mongoose.model(
  "Mark",
  new Schema(
    {
      student: { type: Schema.Types.ObjectId, ref: "Student" },
      head: { type: Schema.Types.ObjectId, ref: "Head" },
    },
    { strict: false },
  ),
  "marks",
);
```

#### 8b. Run the migration once

```javascript
// One-time migration: link each Mark document to its Head.
// For every head, find all marks with the same hid and store the
// head's _id in the mark's `head` field. Once this field holds an
// ObjectId reference, .populate("head") can replace it with the
// full head document.

db.Head.find()
  .then(async (heads) => {
    for (const head of heads) {
      const result = await db.Mark.updateMany(
        { hid: head.hid },
        { $set: { head: head._id } },
      );
      console.log(head.hid, head.headname, result.modifiedCount);
    }
  })
  .then(() => process.exit());
```

```
1 Quiz 1 38
2 Quiz 2 38
...
8 CP 1 38
```

Each of the 8 heads updates 38 marks, one per student. Delete or comment out the migration afterwards.

#### 8c. Populate the head

```javascript
db.Mark.find({ regno: "1712218" })
  .sort({ mid: 1 })
  .populate("head")
  .then(displayDocs);
```

```
[
  { _id: ..., mid: 1, regno: '1712218', hid: 1, marks: 4.25, student: new ObjectId('6ade...04fd'), head: { _id: ..., hid: 1, headname: 'Quiz 1', total: 5 } },
  { _id: ..., mid: 2, regno: '1712218', hid: 2, marks: 4, student: new ObjectId('6ade...04fd'), head: { _id: ..., hid: 2, headname: 'Quiz 2', total: 5 } },
  ...
]
```

`head` is filled in; `student` is still an ObjectId because you did not ask for it.

#### 8d. Populate both, and choose the fields

You can chain `populate()` calls. The second argument picks which fields of the referenced document to return, and `select()` picks the fields of the mark itself:

```javascript
db.Mark.find({ regno: "1712218" })
  .select({ _id: 0, mid: 1, marks: 1, student: 1, head: 1 })
  .populate("student", "regno name")
  .populate("head", "headname total")
  .sort({ mid: 1 })
  .then(displayDocs);
```

```
[
  { mid: 1, marks: 4.25, student: { _id: ..., regno: '1712218', name: 'Aadesh Kumar' }, head: { _id: ..., headname: 'Quiz 1', total: 5 } },
  { mid: 2, marks: 4, student: { _id: ..., regno: '1712218', name: 'Aadesh Kumar' }, head: { _id: ..., headname: 'Quiz 2', total: 5 } },
  ...
  { mid: 8, marks: 4, student: { _id: ..., regno: '1712218', name: 'Aadesh Kumar' }, head: { _id: ..., headname: 'CP 1', total: 5 } }
]
```

Keep `student` and `head` in `select()`: if you leave them out, there is no ObjectId to populate from. A populated document keeps its `_id` unless you write `"-_id"` in the field list, for example `"regno name -_id"`.

---

### Step 9: One-to-many, Student to Marks

Now go the other way: one student has many marks. The usual way to model this with references is an **array of ObjectIds** on the student.

#### 9a. Add the `marks` array to the Student schema

In `models.js`, replace the `Student` line with:

```javascript
const Student = mongoose.model(
  "Student",
  new Schema(
    {
      marks: [{ type: Schema.Types.ObjectId, ref: "Mark" }],
    },
    { strict: false },
  ),
  "students",
);
```

The square brackets make `marks` an array; each element is the `_id` of a `Mark`.

The complete `models.js` now looks like this:

```javascript
import mongoose from "mongoose";
const { Schema } = mongoose;

if (mongoose.connection.readyState !== 1) {
      await mongoose.connect("mongodb://192.168.10.128:27017/recapsheet");
}

const Grade = mongoose.model("Grade", new Schema({}, { strict: false }), "grades");
const Head = mongoose.model("Head", new Schema({}, { strict: false }), "heads");
const Mark = mongoose.model(
  "Mark",
  new Schema(
    {
      student: { type: Schema.Types.ObjectId, ref: "Student" },
      head: { type: Schema.Types.ObjectId, ref: "Head" },
    },
    { strict: false },
  ),
  "marks",
);
const Student = mongoose.model(
  "Student",
  new Schema(
    {
      marks: [{ type: Schema.Types.ObjectId, ref: "Mark" }],
    },
    { strict: false },
  ),
  "students",
);

export const db = { Grade, Head, Mark, Student };
```

#### 9b. Run the migration once

```javascript
// One-time migration: store the _id of every mark in the student's
// `marks` array. Run once, then comment it out again.

db.Student.find()
  .then(async (students) => {
    for (const student of students) {
      const ids = await db.Mark.find({ regno: student.regno }).select({ _id: 1 });
      const result = await db.Student.updateOne(
        { regno: student.regno },
        { $push: { marks: ids } },
      );
      console.log(student.regno, result.modifiedCount);
    }
  })
  .then(() => process.exit());
```

```
1712218 1
1712219 1
...
```

For each student:

1. `db.Mark.find({ regno }).select({ _id: 1 })` fetches that student's 8 marks, keeping only `_id`.
2. `updateOne(..., { $push: { marks: ids } })` adds them to the student's `marks` array. Because the schema says `marks` is an array of ObjectIds, Mongoose turns each `{ _id: ... }` document into its ObjectId and pushes all eight.
3. `modifiedCount` is `1`: one student document changed.

> **Run this one only once.** Unlike `$set`, `$push` adds to whatever is already in the array, so a second run gives every student 16 entries. If that happens, empty the arrays with `db.Student.updateMany({}, { $set: { marks: [] } })` and run the migration again.

Check what was stored:

```javascript
db.Student.find({ regno: "1712218" }).then(displayDocs);
```

```
[
  { _id: new ObjectId('6ade...04fd'), regno: '1712218', name: 'Aadesh Kumar', marks: [ new ObjectId('6ade...9130'), new ObjectId('6ade...9131'), ... 8 ids ... ] }
]
```

#### 9c. Populate the marks

```javascript
db.Student.find({ regno: "1712218" })
  .populate({
    path: "marks",
    select: "mid hid marks -_id",
    options: { sort: { mid: 1 } },
  })
  .then((students) => console.log(JSON.stringify(students, null, 4)))
  .then(() => process.exit());
```

```json
[
    {
        "_id": "6ade20312540a0383e5925e8",
        "regno": "1712218",
        "name": "Aadesh Kumar",
        "marks": [
            { "mid": 1, "hid": 1, "marks": 4.25 },
            { "mid": 2, "hid": 2, "marks": 4 },
            { "mid": 3, "hid": 3, "marks": 2.25 },
            { "mid": 4, "hid": 4, "marks": 2.5 },
            { "mid": 5, "hid": 5, "marks": 33.5 },
            { "mid": 6, "hid": 6, "marks": 14.5 },
            { "mid": 7, "hid": 7, "marks": 12.5 },
            { "mid": 8, "hid": 8, "marks": 4 }
        ]
    }
]
```

(The real output puts each field on its own line; it is shortened here.)

`populate()` also takes an object instead of a string: `path` is the field, `select` the fields to keep, and `options.sort` the order of the populated array. Drop the `{ regno: "1712218" }` filter to see all 38 students.

#### 9d. Populate two levels deep

Each mark has a `head` reference from Step 8, so you can populate inside the populated marks:

```javascript
db.Student.find({ regno: "1712218" })
  .populate({
    path: "marks",
    select: "mid marks head -_id",
    options: { sort: { mid: 1 } },
    populate: { path: "head", select: "headname total -_id" },
  })
  .then((students) => console.log(JSON.stringify(students, null, 4)))
  .then(() => process.exit());
```

```json
"marks": [
    { "mid": 1, "marks": 4.25, "head": { "headname": "Quiz 1", "total": 5 } },
    { "mid": 2, "marks": 4,    "head": { "headname": "Quiz 2", "total": 5 } },
    ...
    { "mid": 8, "marks": 4,    "head": { "headname": "CP 1", "total": 5 } }
]
```

That is a complete marks sheet for one student, built from three collections.

---

## Part D: Joins with the aggregation pipeline

`populate()` runs separate queries from Node.js and joins the results in Mongoose. The aggregation pipeline does the join **inside MongoDB** with the `$lookup` stage, and it can join on any field, so it does not need the ObjectId references from Part C. All of Part D joins on the original `regno` and `hid` fields.

An aggregation is an array of stages. Each stage receives the documents from the previous one, changes them, and passes them on:

```
students ──> $lookup ──> $unwind ──> $group ──> $project ──> result
```

`Model.aggregate([...])` sends the pipeline to MongoDB as written. The results are plain JavaScript objects, not Mongoose documents.

### Step 10: Aggregation with $lookup

This stage joins the Student collection with the Mark collection on `regno`, and adds an array of matching marks to each student.

```javascript
db.Student.aggregate([
  {
    $lookup: {
      from: "marks",        // collection name in MongoDB
      localField: "regno",  // field in Student
      foreignField: "regno", // field in Mark
      as: "obtain",         // output array field
    },
  },
])
  .then((res) => console.log(JSON.stringify(res, null, 4)))
  .then(() => process.exit(0));
```

| Option | Meaning |
|---|---|
| `from` | The collection to join with. This is the **collection name** (`"marks"`), not the model name (`"Mark"`). |
| `localField` | The field in the input documents (students). |
| `foreignField` | The field in the `from` collection (marks). |
| `as` | The name of the new array field. Every mark whose `regno` equals the student's `regno` goes into it. |

This is the same as SQL's `students LEFT JOIN marks ON students.regno = marks.regno`, except that the matching rows are nested inside each student instead of repeating the student once per row.

Output (first student, shortened):

```json
[
    {
        "_id": "6ade20312540a0383e5925e7",
        "regno": "1712219",
        "name": "Ajay Kumar",
        "marks": [ "6ade...2de1", "6ade...2de3", ... ],
        "obtain": [
            { "_id": "6ade...2de1", "mid": 9, "regno": "1712219", "hid": 1, "marks": 4,
              "student": "6ade...25e7", "head": "6ade...fa89" },
            { "_id": "6ade...2de3", "mid": 12, "regno": "1712219", "hid": 4, "marks": 4.5,
              "student": "6ade...25e7", "head": "6ade...fa8a" },
            ...
        ]
    },
    ...
]
```

All 38 students are printed, each with 8 marks in `obtain`. You will also see the `marks`, `student` and `head` fields you added in Part C; `$lookup` reads the documents exactly as they are stored.

To look at a single student, put a `$match` stage first and hide the Part C array with `$project`:

```javascript
db.Student.aggregate([
  { $match: { regno: "1712218" } },
  { $project: { marks: 0 } },
  {
    $lookup: {
      from: "marks",
      localField: "regno",
      foreignField: "regno",
      as: "obtain",
    },
  },
]).then(displayDocs);
```

Putting `$match` first also makes the pipeline faster, because `$lookup` then runs for one student instead of 38.

---

### Step 11: Aggregation with total marks obtained

With all of a student's marks in one array, you can add them up. This pipeline calculates the total marks of every student:

```javascript
db.Student.aggregate([
  {
    $lookup: {
      from: "marks",
      foreignField: "regno",
      localField: "regno",
      as: "obtain",
    },
  },
  {
    $unwind: "$obtain",
  },
  {
    $group: {
      _id: { regno: "$regno", name: "$name" },
      total: { $sum: "$obtain.marks" },
    },
  },
  {
    $project: { _id: 0, regno: "$_id.regno", name: "$_id.name", total: 1 },
  },
  {
    $sort: { regno: 1 },
  },
])
  .then((res) => console.log(JSON.stringify(res, null, 4)))
  .then(() => process.exit());
```

Stage by stage:

1. **`$lookup`** joins each student with their marks, as in Step 10. 38 documents come out, each with an 8-element `obtain` array.
2. **`$unwind: "$obtain"`** turns one document with an 8-element array into 8 documents with one mark each. 38 × 8 = 304 documents come out. After this stage `obtain` is a single mark object, not an array:

   ```json
   { "regno": "1712218", "name": "Aadesh Kumar", "obtain": { "mid": 1, "hid": 1, "marks": 4.25, ... } }
   { "regno": "1712218", "name": "Aadesh Kumar", "obtain": { "mid": 2, "hid": 2, "marks": 4, ... } }
   ...
   ```

3. **`$group`** puts the 304 documents back together, one group per distinct `_id`. Here `_id` is `{ regno, name }`, so each student is one group, and `$sum: "$obtain.marks"` adds up the `marks` value of the 8 documents in each group. `name` is part of the group key only so it is still available after grouping. 38 documents come out:

   ```json
   { "_id": { "regno": "1712218", "name": "Aadesh Kumar" }, "total": 77.5 }
   ```

4. **`$project`** reshapes the output: `_id: 0` drops the group key, `regno: "$_id.regno"` and `name: "$_id.name"` copy its parts to top-level fields, and `total: 1` keeps the total.
5. **`$sort: { regno: 1 }`** orders the result by registration number. `$group` does not keep any order, so without this stage the students come out in a different order on different runs.

Output:

```json
[
    { "total": 77.5,  "regno": "1712218", "name": "Aadesh Kumar" },
    { "total": 74.5,  "regno": "1712219", "name": "Ajay Kumar" },
    { "total": 65.5,  "regno": "1712220", "name": "Anosha Riaz" },
    { "total": 64.5,  "regno": "1712221", "name": "Arbaz Khan Afridi" },
    { "total": 82.5,  "regno": "1712222", "name": "Basit Raza" },
    ...
    { "total": 66.5,  "regno": "1712296", "name": "Abdul Rauf" }
]
```

The head totals add up to 100, so each `total` is also the student's percentage.

> **Try it:** sort by `{ total: -1 }` to rank the class, or add `{ $match: { total: { $gte: 80 } } }` after `$project` to list only students with 80 or more.

---

### Step 12: Aggregation with a $lookup pipeline

`$lookup` has a second form. Instead of `localField` and `foreignField`, it takes a **sub-pipeline** that runs against the `from` collection for every input document. This pipeline starts from the marks and joins each one with its student and its head:

```javascript
db.Mark.aggregate([
  {
    $lookup: {
      from: "students",
      let: { regno: "$regno" },
      pipeline: [
        // Match the Student whose regno equals this mark's regno
        { $match: { $expr: { $eq: ["$regno", "$$regno"] } } },
      ],
      as: "student",
    },
  },
  {
    $lookup: {
      from: "heads",
      let: { hid: "$hid" },
      pipeline: [
        // Match the Head whose hid equals this mark's hid
        { $match: { $expr: { $eq: ["$hid", "$$hid"] } } },
      ],
      as: "head",
    },
  },
  { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
  { $unwind: { path: "$head", preserveNullAndEmptyArrays: true } },
])
  .then((res) => console.log(JSON.stringify(res, null, 4)))
  .then(() => process.exit(0));
```

The new parts:

| Part | Meaning |
|---|---|
| `let: { regno: "$regno" }` | Makes a variable from the **current mark**. `"$regno"` here is the mark's `regno`. |
| `pipeline: [...]` | Stages that run on the `from` collection (`students`). |
| `$$regno` | Two dollar signs read the variable from `let`. One dollar sign (`"$regno"`) inside the pipeline means the **student's** `regno`. |
| `$expr` | Lets `$match` use aggregation expressions such as `$eq: [a, b]`. You need it to compare a field with a variable. |
| `$unwind` with `preserveNullAndEmptyArrays: true` | `$lookup` always produces an array, even for one match. `$unwind` turns the one-element array into a plain object. With this option, a mark whose student or head is missing is kept (the field is just left out) instead of being dropped. |

Output (first mark):

```json
[
    {
        "_id": "6ade2031bcf2969faced2ddb",
        "mid": 1,
        "regno": "1712218",
        "hid": 1,
        "marks": 4.25,
        "student": {
            "_id": "6ade20312540a0383e5925e8",
            "regno": "1712218",
            "name": "Aadesh Kumar",
            "marks": [ "6ade...2ddb", "6ade...2ddc", ... ]
        },
        "head": {
            "_id": "6ade203124d489532295fa89",
            "hid": 1,
            "headname": "Quiz 1",
            "total": 5
        }
    },
    ...
]
```

304 documents, one per mark. Notice that `as: "student"` and `as: "head"` **replace** the `student` and `head` ObjectIds stored in Part C. That is the aggregation version of `.populate("student").populate("head")` from Step 8d.

#### Why use a pipeline?

For an equality join like this one, the simple form from Step 10 gives the same result. The pipeline form is useful when you want to do more inside the join, because any stage can go in the sub-pipeline. This version keeps only the fields you need, and then flattens the result into one line per mark:

```javascript
db.Mark.aggregate([
  { $match: { regno: "1712218" } },
  {
    $lookup: {
      from: "students",
      let: { regno: "$regno" },
      pipeline: [
        { $match: { $expr: { $eq: ["$regno", "$$regno"] } } },
        { $project: { _id: 0, name: 1 } },
      ],
      as: "student",
    },
  },
  {
    $lookup: {
      from: "heads",
      let: { hid: "$hid" },
      pipeline: [
        { $match: { $expr: { $eq: ["$hid", "$$hid"] } } },
        { $project: { _id: 0, headname: 1, total: 1 } },
      ],
      as: "head",
    },
  },
  { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
  { $unwind: { path: "$head", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 0,
      mid: 1,
      regno: 1,
      name: "$student.name",
      head: "$head.headname",
      total: "$head.total",
      marks: 1,
    },
  },
  { $sort: { mid: 1 } },
]).then(displayDocs);
```

```
[
  { mid: 1, regno: '1712218', marks: 4.25, name: 'Aadesh Kumar', head: 'Quiz 1', total: 5 },
  { mid: 2, regno: '1712218', marks: 4, name: 'Aadesh Kumar', head: 'Quiz 2', total: 5 },
  { mid: 3, regno: '1712218', marks: 2.25, name: 'Aadesh Kumar', head: 'Assig. 1', total: 5 },
  { mid: 4, regno: '1712218', marks: 2.5, name: 'Aadesh Kumar', head: 'Assig. 2', total: 5 },
  { mid: 5, regno: '1712218', marks: 33.5, name: 'Aadesh Kumar', head: 'Final 1', total: 35 },
  { mid: 6, regno: '1712218', marks: 14.5, name: 'Aadesh Kumar', head: 'Mid Term 1', total: 25 },
  { mid: 7, regno: '1712218', marks: 12.5, name: 'Aadesh Kumar', head: 'Project 1', total: 15 },
  { mid: 8, regno: '1712218', marks: 4, name: 'Aadesh Kumar', head: 'CP 1', total: 5 }
]
```

This is the same marks sheet as Step 9d, built entirely inside MongoDB.

---

## populate() or $lookup?

| | `populate()` (Part C) | `$lookup` (Part D) |
|---|---|---|
| Where the join happens | In Mongoose: one extra query per populated path | Inside MongoDB, in one aggregation |
| What it joins on | An ObjectId field whose schema path has `ref` | Any fields (`regno`, `hid`, ...) |
| Setup needed | Schema paths with `ref`, and ObjectIds stored in the documents | None |
| Result | Mongoose documents | Plain objects |
| Good for | Loading a document with its related documents | Joins combined with grouping, totals and reshaping |

---

## Reset the database

To start the lab again from Step 6, reload the original data on the VM. `--drop` removes the `student`, `head` and `marks` fields added in Part C along with everything else:

```bash
cd ~/mongodb
for f in JSON/recapsheet/*.json; do
  docker exec -i mongo-db mongoimport --jsonArray --drop \
    -d recapsheet -c "$(basename "${f%.json}")" < "$f"
done
```

Then put the schemas in `models.js` back to `new Schema({}, { strict: false })`, or regenerate it with Step 4.

---

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| `StrictPopulateError: Cannot populate path 'student' because it is not in your schema` | The schema path is missing from `models.js`. Add it with `ref` (Steps 7a, 8a, 9a). This also happens if `models.js` was regenerated. |
| `.populate()` runs but the field stays `null` or an ObjectId | The migration for that field has not run, so there is no ObjectId to look up. Run Step 7b, 8b or 9b. |
| A student's `marks` array has 16 entries | The Step 9b migration ran twice. Empty the arrays with `db.Student.updateMany({}, { $set: { marks: [] } })`, then run it once. |
| `Cannot find module '.../model.js'` | The generated file is `models.js` (with an **s**). Check the import line in `REPL.js`. |
| `$lookup` returns empty `obtain` arrays | `from` must be the collection name (`"marks"`), not the model name (`"Mark"`). |
| `{ headname: "Quiz 1" }` finds nothing | The head names in the data use a non-breaking space between the word and the number. Query by `hid` instead, or use `{ headname: /^Quiz/ }`. |
| The script never returns to the prompt | The code path does not reach `process.exit()`. Press **Ctrl+C**, and check that your `.then(...)` chain ends with `displayDocs` or `process.exit()`. |
| `MongooseServerSelectionError` / `ECONNREFUSED` | The host cannot reach the VM, or the URI in `models.js` is wrong. See the setup lab's troubleshooting table. |
| `No collections found in recapsheet.` | Part A has not run, or `MONGO_URI` points to another database. |

---

## Changes from the original code

All code in this tutorial was run against MongoDB 8.0 with the recapsheet data. These are the places where it differs from the code it was built from:

- **`./model.js` → `./models.js`:** `generate-models.js` writes `models.js`, so the import uses that name.
- **Schema paths added to `models.js` (Steps 7a, 8a, 9a):** the generated models have empty schemas, and Mongoose refuses `.populate("student")` on them with `StrictPopulateError`. In the one-to-many migration, the schema also matters for the `$push`: without the `marks` array path, `$push: { marks: ids }` would store the whole list as **one** nested array element instead of 8 ObjectIds.
- **Migrations use `for ... of` with `await` and end with `process.exit()`:** the original `students.forEach(async ...)` starts all updates without waiting for them, so the script could not tell when they had finished and never exited. The migrations also print the update counts instead of the full result object.
- **One-to-many migration:** the `console.log(JSON.stringify(students, null, 4))` line was dropped. It ran before any update finished and printed the students without their marks.
- **`.sort({ mid: 1 })` added to the `find()` queries,** and **`$sort: { regno: 1 }` added to Step 11:** after the migrations, and after `$group`, documents no longer come back in insertion order.
- **Step 12** (the `$lookup` pipeline) was uncommented, and the extra example with `$project` inside the sub-pipeline was added to show what the pipeline form can do that the simple form cannot.

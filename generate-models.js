// generate-models.js
// Reads every collection from a MongoDB database and creates a schema-less
// Mongoose model for each one, e.g.
//   const Student = mongoose.model("Student", new Schema({}, { strict: false }), "students");
//
// Usage:
//   node generate-models.js                 -> prints the generated code
//   node generate-models.js models.js       -> also writes it to models.js
//
// Or use loadModels() in your app to get the models at runtime.

import fs from "node:fs";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

const { Schema } = mongoose;

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/recapsheet";

if (mongoose.connection.readyState !== 1) {
  await mongoose.connect(MONGO_URI);
}

// "students" -> "Student", "categories" -> "Category", "user_profiles" -> "UserProfile"
function singularize(word) {
  if (/ies$/i.test(word)) return word.replace(/ies$/i, "y");
  if (/sses$/i.test(word)) return word.replace(/sses$/i, "ss");
  if (/s$/i.test(word) && !/(ss|us|is)$/i.test(word)) return word.slice(0, -1);
  return word;
}

function toModelName(collectionName) {
  const parts = collectionName.split(/[_\-\s.]+/).filter(Boolean);
  parts[parts.length - 1] = singularize(parts[parts.length - 1]);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

async function getCollectionNames() {
  const collections = await mongoose.connection.db
    .listCollections({}, { nameOnly: true })
    .toArray();
  return collections
    .map((c) => c.name)
    .filter((name) => !name.startsWith("system."))
    .sort();
}

// Runtime: returns { Student: Model, Course: Model, ... }
async function loadModels() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGO_URI);
  }
  const models = {};
  for (const collection of await getCollectionNames()) {
    const name = toModelName(collection);
    models[name] =
      mongoose.models[name] ||
      mongoose.model(name, new Schema({}, { strict: false }), collection);
  }
  return models;
}

// Code generation: builds a models.js file you can commit and edit
function generateCode(collectionNames) {
  const lines = collectionNames.map((collection) => {
    const name = toModelName(collection);
    return `const ${name} = mongoose.model("${name}", new Schema({}, { strict: false }), "${collection}");`;
  });
  const names = collectionNames.map(toModelName);

  return [
    'import mongoose from "mongoose";',
    "const { Schema } = mongoose;",
    "",
    `if (mongoose.connection.readyState !== 1) {
      await mongoose.connect("${MONGO_URI}");
}`,
    ``,
    ...lines,
    "",
    `export const db = { ${names.join(", ")} };`,
    "",
  ].join("\n");
}

async function main() {
  const collections = await getCollectionNames();

  if (collections.length === 0) {
    console.log(`No collections found in ${mongoose.connection.name}.`);
  } else {
    const code = generateCode(collections);
    console.log(code);

    const outFile = process.argv[2];
    if (outFile) {
      fs.writeFileSync(outFile, code);
      console.log(`Written to ${outFile}`);
    }
  }

  await mongoose.disconnect();
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { loadModels, toModelName };

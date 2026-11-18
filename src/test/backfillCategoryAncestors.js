import "../config/env.js"
import mongoose from "mongoose";
import Category from "../models/category.model.js";

console.log(process.env.MONGO_URI)

await mongoose.connect(process.env.MONGO_URI);

const all = await Category.find().select("parent_id").lean();
const byId = new Map(all.map((c) => [String(c._id), c]));

const getAncestors = (cat) => {
  const result = [];
  let cur = cat.parent_id ? byId.get(String(cat.parent_id)) : null;
  while (cur) {
    result.unshift(cur._id);
    cur = cur.parent_id ? byId.get(String(cur.parent_id)) : null;
  }
  return result;
};

await Category.bulkWrite(
  all.map((c) => {
    const ancestors = getAncestors(c);
    return {
      updateOne: {
        filter: { _id: c._id },
        update: { $set: { ancestors, level: ancestors.length + 1 } },
      },
    };
  }),
);

console.log("Done");
process.exit(0);

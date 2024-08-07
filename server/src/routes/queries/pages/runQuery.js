import { BSON, EJSON, ObjectId } from "bson";
import Mongo from "../../../components/mongo";
import queryBuilder from "../../../utils/queryBuilder";

function functionEvaluator({ value }) {
  let prepareFunc = value.replace("function::", "");
  let result = eval(prepareFunc);
  return result;
}

async function runQuery(req, res, next) {
  try {
    let collectionName = req?.body?.collectionName ?? "";
    let searchMethod = req?.body?.searchMethod ?? "";
    let query = req?.body?.query ?? "";
    let variables = req?.body?.variables ?? {};
    if (Object.keys(variables).length > 0) {
      if (typeof query === "string") {
        query = JSON.parse(query);
      }
      query = queryBuilder({ query, variables });
    } else {
      query = EJSON.parse(query);
    }
    if (collectionName && searchMethod && query) {
      let result = [];
      if (searchMethod === "find") {
        let filter = query?.filter ?? {};
        let projection = query?.projection ?? {};
        let sort = query?.sort ?? {};
        let limit = query?.limit ?? 0;
        limit = limit > 500 || limit === 0 ? 500 : limit;
        let skip = query?.skip ?? 0;
        result = await Mongo.db
          .collection(collectionName)
          .find(filter)
          .project(projection)
          .sort(sort)
          .limit(limit)
          .skip(skip)
          .toArray();
      } else if (searchMethod === "aggregate") {
        let pipeline = query?.pipeline ?? query ?? [];
        result = await Mongo.db
          .collection(collectionName)
          .aggregate(pipeline)
          .toArray();
      } else if (searchMethod === "count") {
        let filter = query?.filter ?? {};
        let options = query?.options ?? {};
        result = await Mongo.db
          .collection(collectionName)
          .countDocuments(filter, options);
        result = { count: result };
      } else if (searchMethod === "findOne") {
        let filter = query?.filter ?? {};
        let projection = query?.projection ?? {};
        let options = query?.options ?? {};
        let sort = query?.sort ?? {};
        result = await Mongo.db
          .collection(collectionName)
          .findOne(filter, { projection, ...options, sort });
      } else if (searchMethod === "distinct") {
        let key = query?.key ?? "";
        let filter = query?.filter ?? {};
        let options = query?.options ?? {};
        result = await Mongo.db
          .collection(collectionName)
          .distinct(key, filter, options);
      }
      result = EJSON.stringify(result);
      result = JSON.parse(result);
      res.status(200).json({ ok: true, result });
    } else {
      res.status(400).json({ ok: false, message: "missing_parameters" });
    }
  } catch (err) {
    next(err);
  }
}

export default runQuery;

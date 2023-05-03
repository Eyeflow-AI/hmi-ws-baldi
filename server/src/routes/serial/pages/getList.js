import Mongo from "../../../components/mongo";
import isIsoDate from "../../../utils/isIsoDate";
import hashCode from "../../../utils/hashCode";

function raiseError(message) {
  let err = new Error(message);
  err.status = 400;
  throw err;
};

function getMatch(reqParams, reqQuery) {

  let match = {};

  if (Boolean(reqQuery) && Object.keys(reqQuery).length > 0) {

    if (reqQuery.hasOwnProperty("min_event_time") || reqQuery.hasOwnProperty("max_event_time")) {
      match = {
        "event_data.info.window_ini_time": {}
      };
      if (reqQuery.hasOwnProperty("min_event_time")) {
        if (!isIsoDate(reqQuery["min_event_time"])) { raiseError("Invalid min_event_time. Valid iso date is required.") };
        // match.start_time["$gte"] = new Date(reqQuery.min_event_time);
        match['event_data.info.window_ini_time']['$gte'] = new Date(reqQuery.min_event_time);
      }
      if (reqQuery.hasOwnProperty("max_event_time")) {
        if (!isIsoDate(reqQuery["max_event_time"])) { raiseError("Invalid max_event_time. Valid iso date is required.") };
        // match.start_time["$lte"] = new Date(reqQuery.max_event_time);
        match['event_data.info.window_ini_time']['$lte'] = new Date(reqQuery.max_event_time);
      };
    };

    if (!Mongo.ObjectId.isValid(reqParams["stationId"])) { raiseError(`Invalid station ${reqParams["stationId"]}. Valid ObjectId is required.`) }

    match.station = Mongo.ObjectId(reqParams["stationId"]);
  };

  return match;
};

/**
* @param {string} [query.min_event_time] - min event time - Iso String Date.
* @param {string} [query.max_event_time] - max event time - Iso String Date.
* @param {string} [query.station] - station - String ObjectId.
*/
async function getList(req, res, next) {

  try {
    let match = getMatch(req.params, req.query);
    let projection = {
      _id: 0,
      inspection_id: '$_id.inspection_id',
      result: '$_id.result',
      date: '$date',
      count: '$count',
    };

    let collection = "inspection_events";
    let limit = 10000;                                          //TODO: Get from config file
    let sort = { 'event_data.info.window_end_time': -1 };
    let hashString;
    let serialList = await Mongo.db.collection(collection).aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            inspection_id: "$event_data.info.inspection_id",
            result: "$event_data.inspection_result.ok",
            // date: { $dateToString: { format: "%Y-%m-%d", date: "$event_data.info.window_ini_time" } }
          },
          date: { $first: "$event_data.info.window_ini_time" },
          count: { $sum: 1 },
        }
      },
      { $project: projection },
      { $sort: { 'result': 1 } },
      // { $sort: sort },
      { $limit: limit },
    ]).toArray();
    let resultsNotOk = [];

    serialList = serialList.map((el, index) => {
      if (!el.result) {
        resultsNotOk.push(el.inspection_id);
      };
      if (el.result && resultsNotOk.includes(el.inspection_id)) {
        el.toDelete = true;
      }
      return el;
    })
    serialList = serialList.filter(el => !el.toDelete);

    let serialListLength = serialList.length;
    serialList.forEach((el, index) => {
      hashString += el.date.toISOString();
      el.index = serialListLength - index;
      el.thumbURL = "/assets/GearIcon.svg";                 //TODO: Get from config file,
      el.thumbStyle = { height: 90 };                            //TODO: Get from config file,
      el._id = el.inspection_id;
      el.status = el.result ? "ok" : "ng";
      hashString += el.status;
    });

    let output = {
      ok: true,
      serialListLength,
      serialList,
      hash: hashString ? hashCode(hashString) : null
    };
    if (process.env.NODE_ENV === "development") {
      output.queryOptions = { match, projection, collection, limit };
    };

    res.status(200).json(output);
  }
  catch (err) {
    next(err);
  };
};

export default getList;
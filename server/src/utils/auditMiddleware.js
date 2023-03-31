import log from './log';
import Mongo from '../components/mongo';

const auditMiddleware = () => (req, res, next) => {

  res.on('finish', () => {
    const method = req?.method?.toLowerCase();
    const url = req?.url;
    const requestId = req?.app?.requestId;
    const body = { ...req?.body } ?? {};
    const query = { ...req?.query } ?? {};
    const params = { ...req?.params } ?? {};
    const tokenData = { ...req?.app?.auth } ?? {};

    if (body.password) {
      body.password = "******";
    };
    if (tokenData.password) {
      tokenData.password = "******";
    };

    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      let auditData = {
        request_id: requestId,
        success: res.statusCode < 400,
        method,
        url,
        route_path: req.route.path,
        query,
        params,
        body,
        token_data: tokenData,
      }

      Mongo.db.collection("audit").insertOne(auditData)
        .then(()=>null)
        .catch(() => log.audit(`Failed to insert audit data: ${JSON.stringify(auditData)}`));
    }; //TODO: Send to Sergio?
 });
  next();
};

export default auditMiddleware;
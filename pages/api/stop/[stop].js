import { getStopInfo } from "../../../lib/tfgm-metrolink";

export default async (req, res) => {
  const { stop } = req.query;

  const stopInfo = await getStopInfo(stop);

  res.statusCode = 200;
  res.json(stopInfo);
};

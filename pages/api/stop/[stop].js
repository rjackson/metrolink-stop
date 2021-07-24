import { getStopInfo } from "../../../lib/tfgm-metrolink";

export default async (req, res) => {
  const { stop } = req.query;

  try {
    res.status(200).json(await getStopInfo(stop));
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

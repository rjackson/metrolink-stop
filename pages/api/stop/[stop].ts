import { NextApiRequest, NextApiResponse } from "next";
import { getStopInfo } from "../../../lib/tfgm-metrolink";

const Stop = async (req: NextApiRequest, res: NextApiResponse) => {
  const { stop: rawStop } = req.query;
  const stop = Array.isArray(rawStop) ? rawStop[0] : rawStop;

  if (!stop) {
    res.status(404).json({ error: "Stop not found" });
    return;
  }

  try {
    res.status(200).json(await getStopInfo(stop));
  } catch (err) {
    console.error(err);
    let message = 'Unknown Error'

    if (err instanceof Error) {
      message = err.message
    }

    res.status(500).json({ error: message });
  }
};

export default Stop;

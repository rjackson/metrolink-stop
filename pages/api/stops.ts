import { NextApiRequest, NextApiResponse } from "next";
import { getStops } from "../../lib/tfgm-metrolink";

const Stops = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    res.status(200).json(await getStops());
  } catch (err) {
    console.error(err);
    let message = 'Unknown Error'

    if (err instanceof Error) {
      message = err.message
    }

    res.status(500).json({ error: message });
  }
};

export default Stops;

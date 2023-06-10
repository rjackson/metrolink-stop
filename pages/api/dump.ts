import { NextApiRequest, NextApiResponse } from "next";
import { getAll } from "../../lib/tfgm-metrolink";

const Dump = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    res.status(200).json(await getAll());
  } catch (err) {
    console.error(err);
    let message = 'Unknown Error'

    if (err instanceof Error) {
      message = err.message
    }

    res.status(500).json({ error: message });
  }
};

export default Dump;

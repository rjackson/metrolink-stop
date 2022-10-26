import { getStops } from "../../lib/tfgm-metrolink";

const Stops = async (req, res) => {
  try {
    res.status(200).json(await getStops());
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

export default Stops;

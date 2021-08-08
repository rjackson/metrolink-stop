import { getAll } from "../../lib/tfgm-metrolink";

const Dump = async (req, res) => {
  try {
    res.status(200).json(await getAll());
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

export default Dump;

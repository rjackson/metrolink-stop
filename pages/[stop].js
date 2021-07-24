import { useRouter } from "next/dist/client/router";
import { useEffect, useState } from "react";

export default function Stop() {
  const router = useRouter();
  const { stop } = router.query;
  const [stopInfo, setStopInfo] = useState();
  const [refreshTrigger, setRefreshTrigger] = useState(false);

  useEffect(async () => {
    let mounted = true;
    if (!stop) {
      return;
    }
    try {
      const req = await fetch(`/api/stop/${stop}`);
      const data = await req.json();

      if (mounted) {
        setStopInfo(data);
      }
    } catch (err) {
      console.log(err);
    }

    return () => {
      mounted = false;
    };
  }, [stop, refreshTrigger]);

  // Refresh every 30s
  useEffect(() => {
    const timeout = setTimeout(() => setRefreshTrigger(!refreshTrigger), 30 * 1000);

    return () => {
      clearTimeout(timeout);
    };
  }, [refreshTrigger]);

  return (
    <main>
      <pre>{JSON.stringify(stopInfo, null, 2)}</pre>
    </main>
  );
}

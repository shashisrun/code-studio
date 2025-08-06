import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

export function CdpLogViewer() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      unlisten = await listen<string>("cdp-event", (event) => {
        setLogs((prev) => [...prev, event.payload]);
      });
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <div className="bg-black text-green-400 p-2 h-64 overflow-auto rounded border border-gray-700">
      <div className="font-bold mb-2">Browser Logs</div>
      <pre className="whitespace-pre-wrap text-xs">
        {logs.length === 0 ? "No logs yet." : logs.join("\n")}
      </pre>
    </div>
  );
}

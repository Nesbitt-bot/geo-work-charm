export interface LogEntry {
  id: number;
  at: string;
  level: "info" | "warn";
  message: string;
}
export function Debugging({
  logs,
  onClear,
}: {
  logs: LogEntry[];
  onClear: () => void;
}) {
  return (
    <section className="logging-panel" aria-label="Debugging logs">
      <div className="logging-toolbar">
        <span>Session logs</span>
        <button onClick={onClear}>Clear</button>
      </div>
      {!logs.length ? (
        <p className="empty-log">No events yet.</p>
      ) : (
        <ol className="log-list">
          {logs.map((log) => (
            <li key={log.id} className={log.level}>
              <time>{log.at}</time>
              <span>{log.message}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

import Link from "next/link";
import { backupIsConfigured, MAX_BACKUP_BYTES } from "@/lib/server/stock-backup";

export const runtime = "nodejs";

const errors: Record<string, string> = {
  unconfigured: "Set BACKUP_ADMIN_PASSWORD in the server environment before using backups.",
  password: "The backup password was incorrect.",
  confirmation: "Type RESTORE to confirm the replacement.",
  file: "Choose a Bits Stock JSON backup file.",
  size: `The file is larger than ${MAX_BACKUP_BYTES / 1024 / 1024} MB.`,
  invalid: "The file is invalid or does not match this database version. No data was changed.",
  failed: "The restore failed. No data was changed.",
};

export default async function BackupPage({ searchParams }: {
  searchParams: Promise<{ error?: string; restored?: string }>;
}) {
  const params = await searchParams;
  const configured = backupIsConfigured();
  return (
    <main className="backup-page">
      <div className="backup-wrap">
        <Link className="backup-back" href="/">← Back to dashboard</Link>
        <div className="backup-kicker">DATA MANAGEMENT</div>
        <h1>Database backup</h1>
        <p className="backup-intro">Save a copy of the complete stock database. It includes products, stock sheets, entries, parties, sales, warranty records, and their original IDs and dates.</p>
        {!configured && <div className="backup-alert">Set <code>BACKUP_ADMIN_PASSWORD</code> on the server to enable downloads and restores.</div>}
        {params.error && <div className="backup-alert" role="alert">{errors[params.error] ?? errors.failed}</div>}
        {params.restored && <div className="backup-success" role="status">Restore complete. {Number(params.restored) || 0} records imported.</div>}
        <div className="backup-grid">
          <section className="backup-card">
            <span className="backup-step">01 · KEEP A COPY</span>
            <h2>Download backup</h2>
            <p>Store the downloaded JSON file somewhere safe. You can restore it later on a database with the same app schema.</p>
            <form action="/api/backup/export" method="post">
              <label htmlFor="export-password">Admin backup password</label>
              <input id="export-password" name="password" type="password" autoComplete="current-password" required disabled={!configured} />
              <button type="submit" disabled={!configured}>Download full backup ↓</button>
            </form>
          </section>
          <section className="backup-card backup-restore">
            <span className="backup-step">02 · RESTORE A COPY</span>
            <h2>Import backup</h2>
            <p>This replaces <strong>all current stock data</strong>. Download a fresh backup of the current database first. If an import fails, the current data stays intact.</p>
            <form action="/api/backup/import" method="post" encType="multipart/form-data">
              <label htmlFor="backup-file">Bits Stock JSON backup · up to {MAX_BACKUP_BYTES / 1024 / 1024} MB</label>
              <input id="backup-file" name="file" type="file" accept=".json,application/json" required disabled={!configured} />
              <label htmlFor="import-password">Admin backup password</label>
              <input id="import-password" name="password" type="password" autoComplete="current-password" required disabled={!configured} />
              <label htmlFor="backup-confirmation">Type RESTORE to replace current data</label>
              <input id="backup-confirmation" name="confirmation" pattern="RESTORE" placeholder="RESTORE" autoComplete="off" required disabled={!configured} />
              <button type="submit" disabled={!configured}>Replace data from file</button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

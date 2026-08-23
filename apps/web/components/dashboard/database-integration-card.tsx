"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Database, Loader2, RefreshCw, Trash2 } from "lucide-react";

type SourceType = "postgres" | "mysql" | "mongodb" | "convex";

type SourceTable = {
  tableName: string;
  rowCount: number | null;
  relevant: boolean;
  included: boolean;
};

type DataSource = {
  id: string;
  type: SourceType;
  label: string;
  host: string | null;
  databaseName: string | null;
  status: string;
  lastSyncedAt: string | null;
  tables: SourceTable[];
};

const TYPE_LABELS: Record<SourceType, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL",
  mongodb: "MongoDB",
  convex: "Convex",
};

export function DatabaseIntegrationCard({
  domainId,
  agentId,
}: {
  domainId: string;
  agentId: string;
}) {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [type, setType] = useState<SourceType>("postgres");
  const [form, setForm] = useState({
    label: "",
    host: "",
    port: "5432",
    database: "",
    username: "",
    password: "",
    uri: "mongodb://localhost:27017",
    url: "",
    deployKey: "",
  });
  const [connecting, setConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selections, setSelections] = useState<Record<string, Set<string>>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/integrations/databases?domainId=${domainId}&agentId=${agentId}`,
      );
      if (!res.ok) return;
      const body = (await res.json()) as { sources?: DataSource[] };
      const next = body.sources ?? [];
      setSources(next);
      const nextSelections: Record<string, Set<string>> = {};
      for (const source of next) {
        nextSelections[source.id] = new Set(
          source.tables.filter((t) => t.included).map((t) => t.tableName),
        );
      }
      setSelections(nextSelections);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [domainId, agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function connect() {
    setConnecting(true);
    setError(null);
    const payload =
      type === "postgres" || type === "mysql"
        ? {
            type,
            domainId,
            agentId,
            label: form.label || `${TYPE_LABELS[type]} database`,
            host: form.host,
            port: Number(form.port),
            database: form.database,
            username: form.username,
            password: form.password,
          }
        : type === "mongodb"
          ? {
              type,
              domainId,
              agentId,
              label: form.label || "MongoDB",
              uri: form.uri,
              database: form.database || undefined,
            }
          : {
              type,
              domainId,
              agentId,
              label: form.label || "Convex",
              url: form.url,
              deployKey: form.deployKey,
            };

    try {
      const res = await fetch("/api/integrations/databases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        setError(body?.error?.message ?? "Could not connect.");
        return;
      }
      await load();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setConnecting(false);
    }
  }

  function toggleTable(sourceId: string, tableName: string) {
    setSelections((prev) => {
      const current = prev[sourceId] ?? new Set<string>();
      const next = new Set(current);
      if (next.has(tableName)) next.delete(tableName);
      else next.add(tableName);
      return { ...prev, [sourceId]: next };
    });
  }

  async function saveAndSync(source: DataSource) {
    setSyncingId(source.id);
    setError(null);
    const selected = selections[source.id] ?? new Set<string>();
    try {
      const patchRes = await fetch("/api/integrations/databases", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domainId,
          dataSourceId: source.id,
          selections: source.tables.map((table) => ({
            tableName: table.tableName,
            included: selected.has(table.tableName),
          })),
        }),
      });
      if (!patchRes.ok) {
        const body = (await patchRes.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not save selection.");
        return;
      }
      const syncRes = await fetch("/api/integrations/databases", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domainId, dataSourceId: source.id }),
      });
      const syncBody = (await syncRes.json().catch(() => null)) as {
        documentsCreated?: number;
        error?: { message?: string };
      } | null;
      if (!syncRes.ok) {
        setError(syncBody?.error?.message ?? "Sync failed.");
        return;
      }
      await load();
    } catch {
      setError("Network error during sync.");
    } finally {
      setSyncingId(null);
    }
  }

  async function disconnect(sourceId: string) {
    setSyncingId(sourceId);
    try {
      await fetch(
        `/api/integrations/databases?domainId=${domainId}&dataSourceId=${sourceId}`,
        { method: "DELETE" },
      );
      await load();
    } finally {
      setSyncingId(null);
    }
  }

  const portPlaceholder = useMemo(
    () => (type === "postgres" ? "5432" : type === "mysql" ? "3306" : ""),
    [type],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">Connect your own database</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Let your AI agent answer from live data — products, bookings,
        availability and more. Credentials are encrypted at rest and only
        sampled read-only.
      </p>

      {!loaded ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : sources.length === 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="db-type">Type</Label>
              <select
                id="db-type"
                value={type}
                onChange={(e) => {
                  const value = e.target.value as SourceType;
                  setType(value);
                  update(
                    "port",
                    value === "postgres"
                      ? "5432"
                      : value === "mysql"
                        ? "3306"
                        : "",
                  );
                }}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {(Object.keys(TYPE_LABELS) as SourceType[]).map((key) => (
                  <option key={key} value={key}>
                    {TYPE_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="db-label">Label</Label>
              <Input
                id="db-label"
                placeholder="My production DB"
                value={form.label}
                onChange={(e) => update("label", e.target.value)}
              />
            </div>
          </div>

          {(type === "postgres" || type === "mysql") && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="db-host">Host</Label>
                  <Input
                    id="db-host"
                    placeholder="db.example.com"
                    value={form.host}
                    onChange={(e) => update("host", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="db-port">Port</Label>
                  <Input
                    id="db-port"
                    placeholder={portPlaceholder}
                    value={form.port}
                    onChange={(e) => update("port", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="db-name">Database</Label>
                  <Input
                    id="db-name"
                    placeholder="mydb"
                    value={form.database}
                    onChange={(e) => update("database", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="db-user">Username</Label>
                  <Input
                    id="db-user"
                    autoComplete="off"
                    value={form.username}
                    onChange={(e) => update("username", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="db-pass">Password</Label>
                  <Input
                    id="db-pass"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {type === "mongodb" && (
            <div className="space-y-1.5">
              <Label htmlFor="db-uri">Connection URI</Label>
              <Input
                id="db-uri"
                placeholder="mongodb+srv://user:pass@cluster.mongodb.net/mydb"
                value={form.uri}
                onChange={(e) => update("uri", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Include the database name in the URI or fill it below.
              </p>
              <Input
                placeholder="Database name (optional)"
                value={form.database}
                onChange={(e) => update("database", e.target.value)}
              />
            </div>
          )}

          {type === "convex" && (
            <div className="space-y-1.5">
              <div className="space-y-1.5">
                <Label htmlFor="convex-url">Deployment URL</Label>
                <Input
                  id="convex-url"
                  placeholder="https://acme-xyz123.convex.cloud"
                  value={form.url}
                  onChange={(e) => update("url", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Ends in{" "}
                  <span className="font-mono">.convex.cloud</span> — from the
                  Convex dashboard Settings page or{" "}
                  <span className="font-mono">npx convex env</span>. Not the
                  site URL (that one ends in .convex.site).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="convex-key">Deploy key</Label>
                <Input
                  id="convex-key"
                  type="password"
                  placeholder="prod:acme-xyz123|..."
                  value={form.deployKey}
                  onChange={(e) => update("deployKey", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Create one under Settings → Deploy keys. We only ever read
                  table samples.
                </p>
              </div>
            </div>
          )}

          <Button onClick={connect} disabled={connecting}>
            {connecting ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Connecting…
              </>
            ) : (
              "Test & connect"
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {sources.map((source) => {
            const selected = selections[source.id] ?? new Set<string>();
            return (
              <div key={source.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {source.label}{" "}
                      <span className="text-muted-foreground">
                        · {TYPE_LABELS[source.type]}
                        {source.databaseName ? ` / ${source.databaseName}` : ""}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {source.lastSyncedAt
                        ? `Last synced ${new Date(source.lastSyncedAt).toLocaleString()}`
                        : "Never synced"}
                      {" · "}
                      {selected.size} of {source.tables.length} tables selected
                    </p>
                  </div>
                  <Badge
                    variant={
                      source.status === "connected" ? "default" : "secondary"
                    }
                  >
                    {source.status}
                  </Badge>
                </div>

                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                  {source.tables.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">
                      No tables found.
                    </p>
                  ) : (
                    source.tables.map((table) => (
                      <label
                        key={table.tableName}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selected.has(table.tableName)}
                          onCheckedChange={() =>
                            toggleTable(source.id, table.tableName)
                          }
                        />
                        <span className="flex-1 truncate text-sm">
                          {table.tableName}
                        </span>
                        {table.relevant ? (
                          <Badge variant="secondary">suggested</Badge>
                        ) : null}
                        {table.rowCount !== null ? (
                          <span className="text-xs text-muted-foreground">
                            {table.rowCount} rows
                          </span>
                        ) : null}
                      </label>
                    ))
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => saveAndSync(source)}
                    disabled={syncingId === source.id || selected.size === 0}
                  >
                    {syncingId === source.id ? (
                      <>
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        Syncing…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-1 h-3.5 w-3.5" />
                        Save & sync
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => disconnect(source.id)}
                    disabled={syncingId === source.id}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Disconnect
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Synced tables become knowledge your agent answers from.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

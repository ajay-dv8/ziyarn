"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  ChevronDown,
  Database,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";

type SourceType = "postgres" | "mysql" | "mongodb" | "convex";

type SourceTable = {
  tableName: string;
  rowCount: number | null;
  relevant: boolean;
  included: boolean;
  includeProducts: boolean;
  productEligible: boolean;
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
  const [syncNotice, setSyncNotice] = useState<{
    sourceId: string;
    ok: boolean;
    partial: boolean;
    message: string;
  } | null>(null);

  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [savedSelections, setSavedSelections] = useState<
    Record<string, Set<string>>
  >({});
  const [productSelections, setProductSelections] = useState<
    Record<string, Set<string>>
  >({});
  const [savedProductSelections, setSavedProductSelections] = useState<
    Record<string, Set<string>>
  >({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
      const nextSaved: Record<string, Set<string>> = {};
      const nextProducts: Record<string, Set<string>> = {};
      const nextSavedProducts: Record<string, Set<string>> = {};
      for (const source of next) {
        const included = new Set(
          source.tables.filter((table) => table.included).map((table) => table.tableName),
        );
        nextSelections[source.id] = new Set(included);
        nextSaved[source.id] = included;
        const products = new Set(
          source.tables.filter((table) => table.includeProducts).map((table) => table.tableName),
        );
        nextProducts[source.id] = new Set(products);
        nextSavedProducts[source.id] = products;
      }
      setSelections(nextSelections);
      setSavedSelections(nextSaved);
      setProductSelections(nextProducts);
      setSavedProductSelections(nextSavedProducts);
      setExpanded((prev) => {
        const merged = { ...prev };
        for (const source of next) {
          if (!(source.id in merged)) {
            // Freshly connected sources start expanded; known ones keep
            // the user's collapse choice.
            merged[source.id] = !source.lastSyncedAt;
          }
        }
        return merged;
      });
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

  /** True when the user toggled tables since the last save/sync. */
  function isDirty(source: DataSource): boolean {
    const current = selections[source.id] ?? new Set<string>();
    const saved = savedSelections[source.id] ?? new Set<string>();
    const currentProducts = productSelections[source.id] ?? new Set<string>();
    const savedProducts = savedProductSelections[source.id] ?? new Set<string>();
    const setsDiffer = (a: Set<string>, b: Set<string>) => {
      if (a.size !== b.size) return true;
      for (const name of a) if (!b.has(name)) return true;
      return false;
    };
    return (
      setsDiffer(current, saved) || setsDiffer(currentProducts, savedProducts)
    );
  }

  function toggleExpanded(sourceId: string) {
    setExpanded((prev) => ({ ...prev, [sourceId]: !prev[sourceId] }));
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

  function toggleProductTable(sourceId: string, tableName: string) {
    setProductSelections((prev) => {
      const current = prev[sourceId] ?? new Set<string>();
      const next = new Set(current);
      if (next.has(tableName)) next.delete(tableName);
      else next.add(tableName);
      return { ...prev, [sourceId]: next };
    });
  }

  async function saveAndSync(source: DataSource) {
    setSyncingId(source.id);
    setSyncNotice(null);
    setError(null);
    const selected = selections[source.id] ?? new Set<string>();
    const selectedProducts = productSelections[source.id] ?? new Set<string>();
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
            includeProducts: selectedProducts.has(table.tableName),
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
        skipped?: Array<{ tableName: string; error: string }>;
        error?: { message?: string };
      } | null;
      if (!syncRes.ok) {
        setError(syncBody?.error?.message ?? "Sync failed.");
        return;
      }
      const created = syncBody?.documentsCreated ?? 0;
      const skippedTables = syncBody?.skipped ?? [];
      setSyncNotice({
        sourceId: source.id,
        ok: true,
        partial: skippedTables.length > 0,
        message:
          skippedTables.length === 0
            ? `Synced just now — ${created} table(s) added to your agent's knowledge base.`
            : `Synced ${created} table(s), skipped ${skippedTables.length}: ${skippedTables
                .map((skippedTable) => `${skippedTable.tableName} (${skippedTable.error})`)
                .join(", ")}`,
      });
      await load();
    } catch {
      setError("Network error during sync.");
    } finally {
      setSyncingId(null);
    }
  }

  async function disconnect(sourceId: string) {
    setSyncingId(sourceId);
    setSyncNotice(null);
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
            const selectedProducts = productSelections[source.id] ?? new Set<string>();
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

                <button
                  type="button"
                  onClick={() => toggleExpanded(source.id)}
                  aria-expanded={expanded[source.id] ?? false}
                  className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
                >
                  <span className="flex items-center gap-1.5">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        expanded[source.id] ? "" : "-rotate-90"
                      }`}
                    />
                    Tables ({source.tables.length})
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {isDirty(source)
                      ? "Unsaved changes"
                      : `${selected.size} knowledge · ${selectedProducts.size} products`}
                  </span>
                </button>

                {expanded[source.id] ? (
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                    {source.tables.length === 0 ? (
                      <p className="p-2 text-sm text-muted-foreground">
                        No tables found.
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          <span className="w-4" />
                          <span className="flex-1">Table</span>
                          <span className="w-16 text-center">Knowledge</span>
                          <span className="w-16 text-center">Products</span>
                        </div>
                        {source.tables.map((table) => {
                          const productChecked = selectedProducts.has(
                            table.tableName,
                          );
                          return (
                            <div
                              key={table.tableName}
                              className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50"
                            >
                              <Checkbox
                                checked={selected.has(table.tableName)}
                                onCheckedChange={() =>
                                  toggleTable(source.id, table.tableName)
                                }
                                aria-label={`Include ${table.tableName} in knowledge base`}
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
                              <Checkbox
                                checked={productChecked}
                                disabled={!table.productEligible}
                                onCheckedChange={() =>
                                  toggleProductTable(source.id, table.tableName)
                                }
                                aria-label={`Sync products from ${table.tableName}`}
                              />
                            </div>
                          );
                        })}
                        {source.tables.some(
                          (table) =>
                            !table.productEligible &&
                            (selectedProducts.has(table.tableName) ||
                              (savedProductSelections[source.id] ??
                                new Set()).has(table.tableName)),
                        ) ? (
                          <p className="px-2 pt-1 text-xs text-muted-foreground">
                            Greyed tables have no detectable name + price
                            columns and cannot sync products.
                          </p>
                        ) : null}
                        {source.tables.some((table) => {
                          const nowOff = !(
                            productSelections[source.id] ?? new Set()
                          ).has(table.tableName);
                          return (
                            nowOff &&
                            (savedProductSelections[source.id] ?? new Set()).has(
                              table.tableName,
                            )
                          );
                        }) ? (
                          <p className="px-2 pt-1 text-xs text-amber-600 dark:text-amber-400">
                            Deselected tables stop refreshing — their synced
                            products will be marked unavailable on the next
                            product sync.
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => saveAndSync(source)}
                    disabled={
                      syncingId === source.id ||
                      selected.size === 0 ||
                      !isDirty(source)
                    }
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
                    {isDirty(source)
                      ? "Synced tables become knowledge your agent answers from."
                      : "No changes to sync — toggle tables to enable."}
                  </p>
                </div>

                {syncNotice?.sourceId === source.id ? (
                  <p
                    role="status"
                    className={`text-sm ${
                      syncNotice.partial
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {syncNotice.message}
                  </p>
                ) : null}
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

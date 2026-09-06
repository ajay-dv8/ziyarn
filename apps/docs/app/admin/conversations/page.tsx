import { listConversations } from "@/services/admin-service";

const STATUS_OPTIONS = ["active", "escalated", "resolved", "closed"];

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const status = params.status || "";

  const { conversations, total, pageSize } = await listConversations({ page, status });
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <p className="text-sm text-zinc-400">{total} total conversations</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href="/admin/conversations"
          className={`rounded-lg px-3 py-1.5 text-sm ${
            !status ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          All
        </a>
        {STATUS_OPTIONS.map((s) => (
          <a
            key={s}
            href={`/admin/conversations?status=${s}`}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              status === s ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {s}
          </a>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-400">
              <th className="p-4">Title</th>
              <th className="p-4">Domain</th>
              <th className="p-4">Visitor</th>
              <th className="p-4">Status</th>
              <th className="p-4">Messages</th>
              <th className="p-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((conversation) => (
              <tr key={conversation.id} className="border-b border-zinc-800 last:border-0">
                <td className="p-4">
                  <p className="font-medium">
                    {conversation.title ?? "Untitled"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {conversation.agentName}
                  </p>
                </td>
                <td className="p-4 text-zinc-300">{conversation.domainName}</td>
                <td className="p-4 text-zinc-400 font-mono text-xs">
                  {conversation.visitorId?.slice(0, 8) ?? "—"}
                </td>
                <td className="p-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs capitalize ${
                      conversation.status === "active"
                        ? "bg-green-500/10 text-green-500"
                        : conversation.status === "escalated"
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {conversation.status}
                  </span>
                </td>
                <td className="p-4 text-zinc-300">{conversation.messageCount}</td>
                <td className="p-4 text-zinc-400">
                  {new Date(conversation.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {conversations.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-zinc-500">
                  No conversations found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/admin/conversations?page=${p}${status ? `&status=${status}` : ""}`}
              className={`rounded-lg px-3 py-1 text-sm ${
                p === page
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

import { listWorkspaces } from "@/services/admin-service";

export default async function WorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;

  const { workspaces, total, pageSize } = await listWorkspaces({ page });
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Workspaces</h1>
        <p className="text-sm text-zinc-400">{total} total workspaces</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-400">
              <th className="p-4">Name</th>
              <th className="p-4">Owner</th>
              <th className="p-4">Members</th>
              <th className="p-4">Domains</th>
              <th className="p-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {workspaces.map((workspace) => (
              <tr key={workspace.id} className="border-b border-zinc-800 last:border-0">
                <td className="p-4 font-medium">{workspace.name}</td>
                <td className="p-4">
                  <p className="text-zinc-300">{workspace.ownerName}</p>
                  <p className="text-xs text-zinc-500">{workspace.ownerEmail}</p>
                </td>
                <td className="p-4 text-zinc-300">{workspace.memberCount}</td>
                <td className="p-4 text-zinc-300">{workspace.domainCount}</td>
                <td className="p-4 text-zinc-400">
                  {new Date(workspace.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {workspaces.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-zinc-500">
                  No workspaces found
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
              href={`/admin/workspaces?page=${p}`}
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

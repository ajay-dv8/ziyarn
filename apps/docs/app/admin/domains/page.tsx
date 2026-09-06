import { listDomains } from "@/services/admin-service";
import Link from "next/link";

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; plan?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search || "";
  const plan = params.plan || "";

  const { domains, total, pageSize } = await listDomains({ page, search, plan });
  const totalPages = Math.ceil(total / pageSize);

  const plans = ["free", "standard", "pro", "ultimate", "custom"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Domains</h1>
        <p className="text-sm text-zinc-400">{total} total domains</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href="/admin/domains"
          className={`rounded-lg px-3 py-1.5 text-sm ${
            !plan ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          All
        </a>
        {plans.map((p) => (
          <a
            key={p}
            href={`/admin/domains?plan=${p}`}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              plan === p ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {p}
          </a>
        ))}
      </div>

      <form className="flex gap-2">
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Search by name..."
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
        />
        {plan && <input type="hidden" name="plan" value={plan} />}
        <button
          type="submit"
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
        >
          Search
        </button>
      </form>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-400">
              <th className="p-4">Name</th>
              <th className="p-4">Owner</th>
              <th className="p-4">Plan</th>
              <th className="p-4">Business Type</th>
              <th className="p-4">Conversations</th>
              <th className="p-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((domain) => (
              <tr key={domain.id} className="border-b border-zinc-800 last:border-0">
                <td className="p-4">
                  <Link
                    href={`/admin/domains/${domain.id}`}
                    className="text-blue-400 hover:underline"
                  >
                    {domain.name}
                  </Link>
                  <p className="text-xs text-zinc-500">{domain.slug}</p>
                </td>
                <td className="p-4 text-zinc-300">{domain.ownerName}</td>
                <td className="p-4">
                  <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs capitalize text-zinc-300">
                    {domain.plan}
                  </span>
                </td>
                <td className="p-4 text-zinc-300">
                  {domain.businessType ?? "Generic"}
                </td>
                <td className="p-4 text-zinc-300">{domain.conversationCount}</td>
                <td className="p-4 text-zinc-400">
                  {new Date(domain.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {domains.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-zinc-500">
                  No domains found
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
              href={`/admin/domains?page=${p}${search ? `&search=${search}` : ""}${plan ? `&plan=${plan}` : ""}`}
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

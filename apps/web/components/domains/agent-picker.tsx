import Link from "next/link";

/**
 * Picks which agent you are working with inside a domain.
 *
 * Used by the pages whose data hangs off an agent rather than a domain —
 * Knowledge and Databases. Both are shaped the same way: the domain is
 * chosen in the tab bar, and the agent is a second level beneath it.
 *
 * Rendered as links rather than a <select> so the chosen agent is in the URL.
 * That makes the view linkable, keeps the back button working, and means a
 * refresh lands on the same agent instead of silently resetting to the first.
 */
export function AgentPicker({
  domainId,
  agents,
  activeAgentId,
  path,
}: {
  domainId: string;
  agents: { id: string; name: string }[];
  activeAgentId?: string;
  /** The page's own path, so the picker stays on the page it was used on. */
  path: string;
}) {
  // One agent needs no chooser — the page would just be telling the user
  // something they already know.
  if (agents.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {agents.map((agent) => {
        const params = new URLSearchParams({
          domainId,
          agentId: agent.id,
        });
        const isActive = agent.id === activeAgentId;
        return (
          <Link
            key={agent.id}
            href={`${path}?${params.toString()}`}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-input text-muted-foreground hover:text-foreground"
            }`}
          >
            {agent.name}
          </Link>
        );
      })}
    </div>
  );
}

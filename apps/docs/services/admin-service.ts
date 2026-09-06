import { eq, sql, desc, count, ilike, and, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  user,
  domains,
  workspaces,
  workspaceMembers,
  agents,
  conversations,
  messages,
  payments,
  subscriptions,
  products,
  bookings,
  customers,
  leads,
  admins,
} from "@repo/database/schema";

export async function getPlatformStats() {
  const [userCount] = await db.select({ count: count() }).from(user);
  const [domainCount] = await db.select({ count: count() }).from(domains);
  const [conversationCount] = await db.select({ count: count() }).from(conversations);
  const [paymentCount] = await db.select({ count: count() }).from(payments);
  const [activeSubCount] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"));

  const totalRevenue = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountMinor}), 0)` })
    .from(payments)
    .where(eq(payments.status, "paid"));

  return {
    users: userCount?.count ?? 0,
    domains: domainCount?.count ?? 0,
    conversations: conversationCount?.count ?? 0,
    payments: paymentCount?.count ?? 0,
    activeSubscriptions: activeSubCount?.count ?? 0,
    totalRevenue: totalRevenue[0]?.total ?? 0,
  };
}

export async function listUsers({
  page = 1,
  search,
  pageSize = 20,
}: {
  page?: number;
  search?: string;
  pageSize?: number;
} = {}) {
  const offset = (page - 1) * pageSize;

  const where = search
    ? and(
        ilike(user.email, `%${search}%`),
      )
    : undefined;

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(where)
    .orderBy(desc(user.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [total] = await db
    .select({ count: count() })
    .from(user)
    .where(where);

  // Enrich with domain count and plan
  const enriched = await Promise.all(
    users.map(async (userData) => {
      const userDomains = await db
        .select({ id: domains.id, plan: domains.plan })
        .from(domains)
        .where(eq(domains.ownerId, userData.id));

      const planRank: Record<string, number> = {
        free: 0,
        standard: 1,
        pro: 2,
        ultimate: 3,
        custom: 4,
      };
      const bestPlan = userDomains.reduce<string>(
        (best, domain) =>
          (planRank[domain.plan] ?? 0) > (planRank[best] ?? 0) ? domain.plan : best,
        "free",
      );

      const [sessionRow] = await db
        .select()
        .from(user)
        .where(eq(user.id, userData.id))
        .limit(1);

      return {
        ...userData,
        domainCount: userDomains.length,
        plan: bestPlan,
        lastActive: sessionRow?.updatedAt,
      };
    }),
  );

  return {
    users: enriched,
    total: total?.count ?? 0,
    page,
    pageSize,
  };
}

export async function getUserDetail(userId: string) {
  const [userData] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userData) return null;

  const userDomains = await db
    .select()
    .from(domains)
    .where(eq(domains.ownerId, userId));

  const userWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      createdAt: workspaces.createdAt,
    })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      eq(workspaceMembers.workspaceId, workspaces.id),
    )
    .where(eq(workspaceMembers.userId, userId));

  const userSubscriptions = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.ownerId, userId));

  return {
    ...userData,
    domains: userDomains,
    workspaces: userWorkspaces,
    subscriptions: userSubscriptions,
  };
}

export async function listDomains({
  page = 1,
  search,
  plan,
  pageSize = 20,
}: {
  page?: number;
  search?: string;
  plan?: string;
  pageSize?: number;
} = {}) {
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (search) {
    conditions.push(ilike(domains.name, `%${search}%`));
  }
  if (plan) {
    conditions.push(eq(domains.plan, plan as "free" | "standard" | "pro" | "ultimate" | "custom"));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const domainList = await db
    .select({
      id: domains.id,
      name: domains.name,
      slug: domains.slug,
      plan: domains.plan,
      businessType: domains.businessType,
      ownerId: domains.ownerId,
      createdAt: domains.createdAt,
    })
    .from(domains)
    .where(where)
    .orderBy(desc(domains.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [total] = await db
    .select({ count: count() })
    .from(domains)
    .where(where);

  // Enrich with owner name and conversation count
  const enriched = await Promise.all(
    domainList.map(async (domain) => {
      const [owner] = await db
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, domain.ownerId))
        .limit(1);

      const [convCount] = await db
        .select({ count: count() })
        .from(conversations)
        .innerJoin(agents, eq(agents.domainId, domain.id))
        .where(eq(conversations.agentId, agents.id));

      return {
        ...domain,
        ownerName: owner?.name ?? "Unknown",
        ownerEmail: owner?.email ?? "Unknown",
        conversationCount: convCount?.count ?? 0,
      };
    }),
  );

  return {
    domains: enriched,
    total: total?.count ?? 0,
    page,
    pageSize,
  };
}

export async function getDomainDetail(domainId: string) {
  const [domain] = await db
    .select()
    .from(domains)
    .where(eq(domains.id, domainId))
    .limit(1);

  if (!domain) return null;

  const [owner] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, domain.ownerId))
    .limit(1);

  const domainAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.domainId, domainId));

  const [convCount] = await db
    .select({ count: count() })
    .from(conversations)
    .innerJoin(agents, eq(agents.domainId, domainId))
    .where(eq(conversations.agentId, agents.id));

  const [paymentTotal] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountMinor}), 0)` })
    .from(payments)
    .where(eq(payments.domainId, domainId));

  const [productCount] = await db
    .select({ count: count() })
    .from(products)
    .where(eq(products.domainId, domainId));

  const [bookingCount] = await db
    .select({ count: count() })
    .from(bookings)
    .where(eq(bookings.domainId, domainId));

  const [customerCount] = await db
    .select({ count: count() })
    .from(customers)
    .where(eq(customers.domainId, domainId));

  return {
    ...domain,
    ownerName: owner?.name ?? "Unknown",
    ownerEmail: owner?.email ?? "Unknown",
    agents: domainAgents,
    conversationCount: convCount?.count ?? 0,
    totalRevenue: paymentTotal?.total ?? 0,
    productCount: productCount?.count ?? 0,
    bookingCount: bookingCount?.count ?? 0,
    customerCount: customerCount?.count ?? 0,
  };
}

export async function listWorkspaces({
  page = 1,
  pageSize = 20,
}: {
  page?: number;
  pageSize?: number;
} = {}) {
  const offset = (page - 1) * pageSize;

  const workspaceList = await db
    .select()
    .from(workspaces)
    .orderBy(desc(workspaces.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [total] = await db.select({ count: count() }).from(workspaces);

  const enriched = await Promise.all(
    workspaceList.map(async (workspace) => {
      const [owner] = await db
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, workspace.ownerId))
        .limit(1);

      const [memberCount] = await db
        .select({ count: count() })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, workspace.id));

      const workspaceDomainCount = await db
        .select({ count: count() })
        .from(domains)
        .where(eq(domains.ownerId, workspace.ownerId));

      return {
        ...workspace,
        ownerName: owner?.name ?? "Unknown",
        ownerEmail: owner?.email ?? "Unknown",
        memberCount: memberCount?.count ?? 0,
        domainCount: workspaceDomainCount[0]?.count ?? 0,
      };
    }),
  );

  return {
    workspaces: enriched,
    total: total?.count ?? 0,
    page,
    pageSize,
  };
}

export async function listConversations({
  page = 1,
  status,
  pageSize = 20,
}: {
  page?: number;
  status?: string;
  pageSize?: number;
} = {}) {
  const offset = (page - 1) * pageSize;

  const where = status ? eq(conversations.status, status as "active" | "escalated" | "resolved" | "closed") : undefined;

  const conversationList = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      status: conversations.status,
      visitorId: conversations.visitorId,
      createdAt: conversations.createdAt,
      agentId: conversations.agentId,
    })
    .from(conversations)
    .where(where)
    .orderBy(desc(conversations.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [total] = await db
    .select({ count: count() })
    .from(conversations)
    .where(where);

  const enriched = await Promise.all(
    conversationList.map(async (conversation) => {
      const [agent] = await db
        .select({ name: agents.name, domainId: agents.domainId })
        .from(agents)
        .where(eq(agents.id, conversation.agentId))
        .limit(1);

      const [domain] = agent
        ? await db
            .select({ name: domains.name })
            .from(domains)
            .where(eq(domains.id, agent.domainId))
            .limit(1)
        : [null];

      const [messageCount] = await db
        .select({ count: count() })
        .from(messages)
        .where(eq(messages.conversationId, conversation.id));

      return {
        ...conversation,
        agentName: agent?.name ?? "Unknown",
        domainName: domain?.name ?? "Unknown",
        messageCount: messageCount?.count ?? 0,
      };
    }),
  );

  return {
    conversations: enriched,
    total: total?.count ?? 0,
    page,
    pageSize,
  };
}

export async function getRevenueStats({ days = 30 }: { days?: number } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const revenueByDay = await db
    .select({
      date: sql<string>`date(${payments.createdAt})`,
      total: sql<number>`sum(${payments.amountMinor})`,
      count: count(),
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "paid"),
        gte(payments.createdAt, since),
      ),
    )
    .groupBy(sql`date(${payments.createdAt})`)
    .orderBy(sql`date(${payments.createdAt})`);

  const totalRevenue = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountMinor}), 0)` })
    .from(payments)
    .where(eq(payments.status, "paid"));

  const revenueByPlan = await db
    .select({
      plan: domains.plan,
      total: sql<number>`sum(${payments.amountMinor})`,
      count: count(),
    })
    .from(payments)
    .innerJoin(domains, eq(domains.id, payments.domainId))
    .where(eq(payments.status, "paid"))
    .groupBy(domains.plan);

  return {
    revenueByDay,
    totalRevenue: totalRevenue[0]?.total ?? 0,
    revenueByPlan,
  };
}

export async function listAdmins() {
  return db
    .select({
      id: admins.id,
      email: admins.email,
      name: admins.name,
      role: admins.role,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .orderBy(desc(admins.createdAt));
}

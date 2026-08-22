import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { getPlanLimits, type Plan } from "@repo/api/plans";
import {
  Card,
  CardContent,
} from "@repo/ui/components/card";

import { CreateProductButton } from "@/components/dashboard/create-product-button";
import { ProductsList } from "@/components/dashboard/products-list";
import { UpgradeButton } from "@/components/dashboard/upgrade-button";
import { authService } from "@/services/auth-service";
import { domainsService } from "@/services/domains-service";
import { productsService } from "@/services/products-service";
import { settingsService } from "@/services/settings-service";

export const metadata: Metadata = {
  title: "Products",
};

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  standard: 1,
  pro: 2,
  ultimate: 3,
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ domainId?: string }>;
}) {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) {
    return null;
  }

  const domains = await domainsService.listDomains(requestHeaders);
  const plan = domains.reduce<Plan>(
    (best, domain) => (PLAN_RANK[domain.plan] > PLAN_RANK[best] ? domain.plan : best),
    "free",
  );
  const { maxProductsPerDomain } = getPlanLimits(plan);

  const { domainId } = await searchParams;
  const selected = domains.find((domain) => domain.id === domainId) ?? domains[0];
  const domainProducts = selected
    ? await productsService.listProducts({ domainId: selected.id }, requestHeaders)
    : [];

  const settings = await settingsService.getSettings(requestHeaders);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Catalog items your agents can sell in chat. Visitors pay through a
            secure portal link.
          </p>
        </div>
        {selected ? (
          <CreateProductButton
            domains={domains.map((domain) => ({ id: domain.id, name: domain.name }))}
            domainId={selected.id}
            defaultCurrency={settings.defaultCurrency}
          />
        ) : (
          <UpgradeButton
              plan="standard"
              label="Upgrade to Standard"
              current={false}
              email={session.user.email}
            />
        )}
      </div>

      {domains.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {domains.map((domain) => (
            <Link
              key={domain.id}
              href={`/dashboard/products?domainId=${domain.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                selected?.id === domain.id
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              {domain.name}
            </Link>
          ))}
        </div>
      ) : null}

      {!selected ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No domains yet</p>
            <p className="text-sm text-muted-foreground">
              Create a domain first, then add products to its catalog.
            </p>
          </CardContent>
        </Card>
      ) : maxProductsPerDomain === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm font-medium">Catalog products need a paid plan</p>
            <p className="text-sm text-muted-foreground">
              Upgrade to Standard or above to let your agents sell in chat.
            </p>
            <UpgradeButton
              plan="standard"
              label="Upgrade to Standard"
              current={false}
              email={session.user.email}
            />
          </CardContent>
        </Card>
      ) : domainProducts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No products yet</p>
            <p className="text-sm text-muted-foreground">
              Add your first product to let agents sell it in chat.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ProductsList
          products={domainProducts.map((product) => ({
            id: product.id,
            name: product.name,
            description: product.description,
            priceCents: product.priceCents,
            currency: product.currency,
            active: product.active,
          }))}
          defaultCurrency={settings.defaultCurrency}
        />
      )}
    </div>
  );
}

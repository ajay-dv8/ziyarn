import type { Metadata } from "next";
import { headers } from "next/headers";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { CreateDomainForm } from "@/components/domains/create-domain-form";
import { DeleteDomainButton } from "@/components/domains/delete-domain-button";
import { RenameDomainForm } from "@/components/domains/rename-domain-form";
import { domainsService } from "@/lib/domains-service";

export const metadata: Metadata = {
  title: "Domains",
};

export default async function DomainsPage() {
  const domains = await domainsService.listDomains(await headers());

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Domains</h1>
        <p className="text-sm text-muted-foreground">
          Each domain gets its own chatbot agent and embed widget.
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>New domain</CardTitle>
          <CardDescription>
            Pick a name and a unique slug — the slug becomes part of your
            widget URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateDomainForm />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {domains.map((domain) => (
          <Card key={domain.id}>
            <CardHeader>
              <CardTitle>{domain.name}</CardTitle>
              <CardDescription>
                ziyarn.vercel.app/widget/{domain.slug} · {domain.plan} plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RenameDomainForm
                domainId={domain.id}
                currentName={domain.name}
              />
              <DeleteDomainButton domainId={domain.id} />
            </CardContent>
          </Card>
        ))}
        {domains.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No domains yet — create your first one above.
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import type { ReactNode } from "react";

/**
 * Thin client wrapper so the AI Studio page itself stays a Server Component.
 *
 * The panels are rendered on the server and passed in as children; only the tab mechanism
 * needs to be interactive, so none of the provider-health data crosses into a client bundle.
 */
export function AiStudioTabs({
  providers,
  playground,
  routing,
  usage,
}: {
  providers: ReactNode;
  playground: ReactNode;
  routing: ReactNode;
  usage: ReactNode;
}) {
  return (
    <Tabs defaultValue="providers">
      <TabsList>
        <TabsTrigger value="providers">Providers</TabsTrigger>
        <TabsTrigger value="routing">Routing</TabsTrigger>
        <TabsTrigger value="usage">Usage</TabsTrigger>
        <TabsTrigger value="playground">Playground</TabsTrigger>
      </TabsList>
      <TabsContent value="providers">
        <Card>{providers}</Card>
      </TabsContent>
      <TabsContent value="routing">
        <Card>{routing}</Card>
      </TabsContent>
      <TabsContent value="usage">
        <Card>{usage}</Card>
      </TabsContent>
      <TabsContent value="playground">
        <Card>{playground}</Card>
      </TabsContent>
    </Tabs>
  );
}

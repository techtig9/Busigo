"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import type { ReactNode } from "react";

export interface Section {
  value: string;
  label: string;
  count?: number;
  content: ReactNode;
}

/**
 * Generic tabbed page section.
 *
 * A thin client wrapper so a page can stay a Server Component: the panels are rendered on the
 * server and handed in as children, and only the tab mechanism crosses into the client
 * bundle. Several screens in the spec are tab-driven (Business Brain, Settings, agent detail,
 * AI Studio, Security), and each hand-rolling its own tab state is how they drift apart.
 */
export function SectionTabs({ sections, defaultValue }: { sections: Section[]; defaultValue?: string }) {
  return (
    <Tabs defaultValue={defaultValue ?? sections[0]?.value}>
      <TabsList>
        {sections.map((s) => (
          <TabsTrigger key={s.value} value={s.value} count={s.count}>
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {sections.map((s) => (
        <TabsContent key={s.value} value={s.value}>
          {s.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

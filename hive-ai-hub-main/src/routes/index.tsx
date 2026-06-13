import { createFileRoute } from "@tanstack/react-router";
import { HiveProvider } from "@/lib/hive-store";
import { HiveApp } from "@/components/hive/HiveApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HiVe — Your documents, intelligently searched" },
      {
        name: "description",
        content:
          "Organize your PDFs by subject and chat with them. Professional AI assistant for documents.",
      },
      { property: "og:title", content: "HiVe — Your documents, intelligently searched" },
      {
        property: "og:description",
        content: "Professional AI assistant for your PDF library.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <HiveProvider>
      <HiveApp />
    </HiveProvider>
  );
}

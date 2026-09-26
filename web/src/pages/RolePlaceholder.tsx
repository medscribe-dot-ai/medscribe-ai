import { PageHeader } from "../components/ui/PageHeader";

export function RolePlaceholder({ title }: { title: string }) {
  return (
    <PageHeader
      title={title}
      description="Signed in. This area will be filled in during the next phase."
    />
  );
}

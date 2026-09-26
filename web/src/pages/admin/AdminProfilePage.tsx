import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { useAuth } from "../../auth/useAuth";

export function AdminProfilePage() {
  const { session } = useAuth();

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader title="Profile" description="Signed-in admin session. No extra account settings are stored." />
      <Card>
        <dl className="grid gap-3">
          <div><dt className="text-sm text-muted">Name</dt><dd className="text-lg font-semibold">{session?.name || "—"}</dd></div>
          <div><dt className="text-sm text-muted">Email</dt><dd className="font-semibold">{session?.email || "—"}</dd></div>
          <div><dt className="text-sm text-muted">Role</dt><dd className="font-semibold">Admin</dd></div>
        </dl>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Checkbox } from "../components/ui/Checkbox";
import { Dialog } from "../components/ui/Dialog";
import { Divider } from "../components/ui/Divider";
import { Drawer } from "../components/ui/Drawer";
import { DropdownMenu } from "../components/ui/DropdownMenu";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { FieldError } from "../components/ui/FieldError";
import { HelperText } from "../components/ui/HelperText";
import { IconButton } from "../components/ui/IconButton";
import { Input } from "../components/ui/Input";
import { KpiCard } from "../components/ui/KpiCard";
import { Label } from "../components/ui/Label";
import { PageHeader } from "../components/ui/PageHeader";
import { PatientAvatar } from "../components/ui/PatientAvatar";
import { QueueToken } from "../components/ui/QueueToken";
import { SearchInput } from "../components/ui/SearchInput";
import { Section } from "../components/ui/Section";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { Spinner } from "../components/ui/Spinner";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Tabs } from "../components/ui/Tabs";
import { Textarea } from "../components/ui/Textarea";
import { useToast } from "../components/ui/useToast";
import { AdminLayout } from "../layouts/AdminLayout";
import { AuthLayout } from "../layouts/AuthLayout";
import { DoctorLayout } from "../layouts/DoctorLayout";
import { ReceptionistLayout } from "../layouts/ReceptionistLayout";

type ShellName = "admin" | "reception" | "doctor" | "auth";

function DesignGallery({ shell, onShell }: { shell: ShellName; onShell: (shell: ShellName) => void }) {
  const { push } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuNote, setMenuNote] = useState("No menu item selected.");
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader
        title="Design system"
        description="Sample components and shells. This page does not load clinic data."
        actions={
          <>
            <Button variant={shell === "admin" ? "primary" : "secondary"} onClick={() => onShell("admin")}>
              Admin shell
            </Button>
            <Button variant={shell === "reception" ? "primary" : "secondary"} onClick={() => onShell("reception")}>
              Reception shell
            </Button>
            <Button variant={shell === "doctor" ? "primary" : "secondary"} onClick={() => onShell("doctor")}>
              Doctor shell
            </Button>
            <Button variant={shell === "auth" ? "primary" : "secondary"} onClick={() => onShell("auth")}>
              Auth layout
            </Button>
          </>
        }
      />

      <Section title="Actions">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Saving</Button>
          <IconButton label="Sample icon action">
            <span aria-hidden="true">+</span>
          </IconButton>
          <Spinner label="Loading sample" />
        </div>
      </Section>

      <Divider />

      <Section title="Fields">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="sample-name">Name</Label>
            <Input id="sample-name" name="sample-name" placeholder="Sample name" aria-describedby="sample-name-hint" />
            <HelperText id="sample-name-hint">Shown only in this sample.</HelperText>
          </div>
          <div>
            <Label htmlFor="sample-role">Role</Label>
            <Select id="sample-role" defaultValue="admin" aria-describedby="sample-role-error">
              <option value="admin">Admin</option>
              <option value="reception">Receptionist</option>
              <option value="doctor">Doctor</option>
            </Select>
            <FieldError id="sample-role-error">Sample field message.</FieldError>
          </div>
          <SearchInput id="sample-search" label="Search" hint="Filters are not connected." placeholder="Search samples" />
          <div>
            <Label htmlFor="sample-notes">Notes</Label>
            <Textarea id="sample-notes" placeholder="Sample notes" />
          </div>
        </div>
        <Checkbox id="sample-check" label="Sample checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
      </Section>

      <Section title="Status">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="mint">Mint</Badge>
          <StatusBadge label="Waiting" tone="warning" />
          <StatusBadge label="In progress" tone="info" />
          <StatusBadge label="Completed" tone="success" />
          <StatusBadge label="Error" tone="danger" />
          <PatientAvatar name="Sample Patient" />
          <QueueToken token="A-12" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard label="Sample metric" value="—" hint="No live data" />
          <Card>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-full" />
          </Card>
        </div>
        <Alert title="Sample notice" tone="info">
          Color is paired with text so status is not color-only.
        </Alert>
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            Open drawer
          </Button>
          <DropdownMenu
            label="Sample menu"
            items={[
              { id: "one", label: "First item", onSelect: () => setMenuNote("First item selected.") },
              { id: "two", label: "Second item", onSelect: () => setMenuNote("Second item selected.") },
            ]}
          />
          <Button variant="secondary" onClick={() => push("Sample toast", "success")}>
            Show toast
          </Button>
        </div>
        <p className="text-sm text-muted">{menuNote}</p>
        <Tabs
          label="Sample tabs"
          tabs={[
            { id: "one", label: "Overview", content: <p className="text-base">Overview sample panel.</p> },
            { id: "two", label: "Details", content: <p className="text-base">Details sample panel.</p> },
          ]}
        />
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <EmptyState title="Nothing here yet" description="Empty states stay short and useful." />
        <ErrorState title="Unable to load this sample" description="Please try again." action={<Button variant="secondary">Retry</Button>} />
      </div>

      <Dialog open={dialogOpen} title="Sample dialog" onClose={() => setDialogOpen(false)}>
        Dialog content stays in a labelled modal with a visible close control.
      </Dialog>
      <Drawer open={drawerOpen} title="Sample drawer" onClose={() => setDrawerOpen(false)}>
        <p className="text-base">This drawer is separate from the navigation drawer.</p>
      </Drawer>
    </div>
  );
}

export function HomePage() {
  const [shell, setShell] = useState<ShellName>("admin");
  const gallery = <DesignGallery shell={shell} onShell={setShell} />;

  if (shell === "auth") {
    return <AuthLayout>{gallery}</AuthLayout>;
  }
  if (shell === "reception") {
    return <ReceptionistLayout>{gallery}</ReceptionistLayout>;
  }
  if (shell === "doctor") {
    return <DoctorLayout>{gallery}</DoctorLayout>;
  }
  return <AdminLayout>{gallery}</AdminLayout>;
}

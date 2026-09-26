import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppError } from "../../api/errors";
import { cleanPhone, validateEmail, validateName, validatePassword, validatePhone, validateUsername } from "../../admin/staffValidation";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { FieldError } from "../../components/ui/FieldError";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import { PageHeader } from "../../components/ui/PageHeader";
import { Spinner } from "../../components/ui/Spinner";
import { createReceptionist, getReceptionist, updateReceptionist } from "../../services/receptionistService";

export function ReceptionistFormPage() {
  const { receptionistId } = useParams();
  const editing = Boolean(receptionistId);
  const navigate = useNavigate();
  const [fields, setFields] = useState({ name: "", username: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!receptionistId) return;
    getReceptionist(Number(receptionistId))
      .then((row) => setFields({ name: row.name, username: row.username, email: row.email, phone: row.phone ?? "", password: "" }))
      .catch((reason: unknown) => setFormError(reason instanceof AppError ? reason.message : "Unable to load this receptionist."))
      .finally(() => setLoading(false));
  }, [receptionistId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const next = {
      name: validateName(fields.name),
      username: validateUsername(fields.username),
      email: validateEmail(fields.email),
      phone: validatePhone(fields.phone),
      password: validatePassword(fields.password, !editing),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    setFormError("");
    const payload = { ...fields, phone: cleanPhone(fields.phone) };
    try {
      if (editing && receptionistId) {
        await updateReceptionist(Number(receptionistId), payload);
        navigate(`/admin/receptionists/${receptionistId}`, { replace: true });
      } else {
        const id = await createReceptionist(payload);
        navigate(`/admin/receptionists/${id}`, { replace: true });
      }
    } catch (reason: unknown) {
      setFormError(reason instanceof AppError ? reason.message : "Unable to save this receptionist.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Loading receptionist" />;

  return (
    <form className="mx-auto flex max-w-3xl flex-col gap-5" onSubmit={onSubmit} noValidate>
      <PageHeader title={editing ? "Edit receptionist" : "Add receptionist"} actions={<Link className="inline-flex min-h-10 items-center font-semibold text-primary-hover" to="/admin/receptionists">Back</Link>} />
      {formError ? <Alert title="Unable to save" tone="danger">{formError}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {(["name", "username", "email", "phone"] as const).map((key) => (
          <div key={key}>
            <Label htmlFor={`recept-${key}`}>{key[0].toUpperCase() + key.slice(1)}</Label>
            <Input id={`recept-${key}`} value={fields[key]} invalid={Boolean(errors[key])} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))} />
            {errors[key] ? <FieldError>{errors[key]}</FieldError> : null}
          </div>
        ))}
        <div>
          <Label htmlFor="recept-password">{editing ? "New password" : "Password"}</Label>
          <Input id="recept-password" type="password" value={fields.password} invalid={Boolean(errors.password)} onChange={(event) => setFields((current) => ({ ...current, password: event.target.value }))} />
          {errors.password ? <FieldError>{errors.password}</FieldError> : null}
        </div>
      </div>
      <Button type="submit" loading={saving}>Save receptionist</Button>
    </form>
  );
}

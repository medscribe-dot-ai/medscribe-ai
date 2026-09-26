import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppError } from "../../api/errors";
import {
  DOCTOR_DAYS,
  SPECIALIZATIONS,
  cleanPhone,
  validateEmail,
  validateExperience,
  validateName,
  validatePassword,
  validatePhone,
  validateSchedule,
  validateUsername,
} from "../../admin/staffValidation";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { FieldError } from "../../components/ui/FieldError";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { createDoctor, getDoctor, updateDoctor } from "../../services/doctorService";

type Fields = {
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  specialization: string;
  experience: string;
  schedule: Record<string, string>;
};

const emptyFields = (): Fields => ({
  name: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  specialization: "",
  experience: "",
  schedule: {},
});

export function DoctorFormPage() {
  const { doctorId } = useParams();
  const editing = Boolean(doctorId);
  const navigate = useNavigate();
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!doctorId) return;
    const id = Number(doctorId);
    if (!Number.isInteger(id)) {
      setFormError("Doctor not found.");
      setLoading(false);
      return;
    }
    getDoctor(id)
      .then((doctor) => {
        setFields({
          name: doctor.name.replace(/^dr\.?\s+/i, ""),
          username: doctor.username,
          email: doctor.email,
          phone: doctor.phone ?? "",
          password: "",
          specialization: doctor.specialization ?? "",
          experience: doctor.experience_years == null ? "" : String(doctor.experience_years),
          schedule: doctor.schedule ?? {},
        });
      })
      .catch((reason: unknown) => setFormError(reason instanceof AppError ? reason.message : "Unable to load this doctor."))
      .finally(() => setLoading(false));
  }, [doctorId]);

  function setField(key: keyof Fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function toggleDay(day: string) {
    setFields((current) => {
      const schedule = { ...current.schedule };
      if (schedule[day]) delete schedule[day];
      else schedule[day] = "09:00 AM - 05:00 PM";
      return { ...current, schedule };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const next = {
      name: validateName(fields.name),
      username: validateUsername(fields.username),
      email: validateEmail(fields.email),
      phone: validatePhone(fields.phone),
      password: validatePassword(fields.password, !editing),
      specialization: fields.specialization ? "" : "Specialization is required.",
      experience: validateExperience(fields.experience),
      schedule: validateSchedule(fields.schedule),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    setFormError("");
    const payload = {
      name: fields.name,
      username: fields.username,
      email: fields.email,
      phone: cleanPhone(fields.phone),
      password: fields.password,
      specialization: fields.specialization,
      experience_years: fields.experience.trim() ? Number(fields.experience) : null,
      schedule: fields.schedule,
    };
    try {
      if (editing && doctorId) {
        await updateDoctor(Number(doctorId), payload);
        navigate(`/admin/doctors/${doctorId}`, { replace: true });
      } else {
        const id = await createDoctor(payload);
        navigate(`/admin/doctors/${id}`, { replace: true });
      }
    } catch (reason: unknown) {
      setFormError(reason instanceof AppError ? reason.message : "Unable to save this doctor.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Spinner label="Loading doctor" />;
  }

  return (
    <form className="mx-auto flex max-w-3xl flex-col gap-5" onSubmit={onSubmit} noValidate>
      <PageHeader
        title={editing ? "Edit doctor" : "Add doctor"}
        description="Account, specialty, and weekly hours."
        actions={<Link className="inline-flex min-h-10 items-center text-base font-semibold text-primary-hover" to="/admin/doctors">Back to doctors</Link>}
      />
      {formError ? <Alert title="Unable to save" tone="danger">{formError}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="doctor-name" label="Full name" value={fields.name} error={errors.name} onChange={(value) => setField("name", value)} />
        <Field id="doctor-username" label="Username" value={fields.username} error={errors.username} onChange={(value) => setField("username", value)} />
        <Field id="doctor-email" label="Email" value={fields.email} error={errors.email} onChange={(value) => setField("email", value)} />
        <Field id="doctor-phone" label="Phone" value={fields.phone} error={errors.phone} onChange={(value) => setField("phone", value)} />
        <Field id="doctor-password" label={editing ? "New password" : "Password"} type="password" value={fields.password} error={errors.password} onChange={(value) => setField("password", value)} />
        <Field id="doctor-experience" label="Experience (years)" value={fields.experience} error={errors.experience} onChange={(value) => setField("experience", value)} />
        <div>
          <Label htmlFor="doctor-specialty">Specialization</Label>
          <Select id="doctor-specialty" value={fields.specialization} invalid={Boolean(errors.specialization)} onChange={(event) => setField("specialization", event.target.value)}>
            <option value="">Select specialization</option>
            {SPECIALIZATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            {fields.specialization && !SPECIALIZATIONS.includes(fields.specialization) ? <option value={fields.specialization}>{fields.specialization}</option> : null}
          </Select>
          {errors.specialization ? <FieldError>{errors.specialization}</FieldError> : null}
        </div>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-base font-semibold text-ink">Weekly schedule</legend>
        {DOCTOR_DAYS.map((day) => {
          const selected = Boolean(fields.schedule[day]);
          return (
            <div key={day} className="grid items-center gap-2 sm:grid-cols-[8rem_1fr]">
              <label className="inline-flex min-h-10 items-center gap-2 text-base font-semibold">
                <input type="checkbox" className="size-5 accent-primary-hover" checked={selected} onChange={() => toggleDay(day)} />
                {day}
              </label>
              {selected ? (
                <Input aria-label={`${day} hours`} value={fields.schedule[day]} onChange={(event) => setFields((current) => ({ ...current, schedule: { ...current.schedule, [day]: event.target.value } }))} />
              ) : <span className="text-sm text-muted">Off</span>}
            </div>
          );
        })}
        {errors.schedule ? <FieldError>{errors.schedule}</FieldError> : null}
      </fieldset>
      <Button type="submit" loading={saving}>Save doctor</Button>
    </form>
  );
}

function Field({ id, label, value, error, onChange, type = "text" }: { id: string; label: string; value: string; error?: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} />
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}

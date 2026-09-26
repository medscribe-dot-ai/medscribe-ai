import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { FieldError } from "../../components/ui/FieldError";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import { PageHeader } from "../../components/ui/PageHeader";
import { duplicatePatientFromError } from "../../reception/duplicatePatient";
import { registerPatient } from "../../services/patientService";
import type { DuplicatePatient, RegisteredPatient } from "../../types/admin";

const GENDERS = ["Male", "Female", "Other"] as const;
const MARITAL = ["Single", "Married"] as const;

type FieldErrors = { name?: string; age?: string; phone?: string };

function validate(name: string, age: string, phone: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim() || name.trim().length < 3) {
    errors.name = "Enter the patient's full name (min 3 characters).";
  }
  const ageTrimmed = age.trim();
  const ageNum = Number(ageTrimmed);
  if (!ageTrimmed || !/^\d+$/.test(ageTrimmed) || ageNum <= 0 || ageNum > 120) {
    errors.age = "Enter a valid age (1–120).";
  }
  const phoneTrimmed = phone.trim();
  if (phoneTrimmed) {
    const digitCount = phoneTrimmed.replace(/\D/g, "").length;
    if (!/^[0-9+\-\s]{7,15}$/.test(phoneTrimmed) || digitCount < 7) {
      errors.phone = "Enter a valid phone number.";
    }
  }
  return errors;
}

export function ReceptionRegisterPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const inFlight = useRef(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<(typeof GENDERS)[number]>("Male");
  const [maritalStatus, setMaritalStatus] = useState<(typeof MARITAL)[number]>("Single");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<RegisteredPatient | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicatePatient | null>(null);

  function resetForm() {
    setName("");
    setAge("");
    setPhone("");
    setGender("Male");
    setMaritalStatus("Single");
    setErrors({});
    setFormError("");
  }

  async function submit(allowDuplicatePhone: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setFormError("");
    try {
      const patient = await registerPatient({
        name: name.trim(),
        age: Number(age.trim()),
        phone: phone.trim() || null,
        gender,
        marital_status: maritalStatus,
        registered_by: session?.receptionist_id ?? null,
        allow_duplicate_phone: allowDuplicatePhone,
      });
      setDuplicate(null);
      setCreated(patient);
    } catch (reason: unknown) {
      const existing = duplicatePatientFromError(reason);
      if (existing && !allowDuplicatePhone) {
        setDuplicate(existing);
      } else {
        setFormError(reason instanceof AppError ? reason.message : "Could not register patient. Please try again.");
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = validate(name, age, phone);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError("Please fix the highlighted fields.");
      return;
    }
    void submit(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Register patient" description="Creates a patient and one-time login credentials." />
      {formError ? <Alert title="Registration failed" tone="danger">{formError}</Alert> : null}
      <form className="grid max-w-xl gap-4" onSubmit={handleSubmit} noValidate>
        <div>
          <Label htmlFor="patient-name">Full name</Label>
          <Input id="patient-name" value={name} invalid={Boolean(errors.name)} aria-describedby={errors.name ? "patient-name-error" : undefined} onChange={(event) => setName(event.target.value)} />
          {errors.name ? <FieldError id="patient-name-error">{errors.name}</FieldError> : null}
        </div>
        <div>
          <Label htmlFor="patient-age">Age</Label>
          <Input id="patient-age" inputMode="numeric" value={age} invalid={Boolean(errors.age)} aria-describedby={errors.age ? "patient-age-error" : undefined} onChange={(event) => setAge(event.target.value)} />
          {errors.age ? <FieldError id="patient-age-error">{errors.age}</FieldError> : null}
        </div>
        <div>
          <Label htmlFor="patient-phone">Phone</Label>
          <Input id="patient-phone" value={phone} invalid={Boolean(errors.phone)} aria-describedby="patient-phone-hint" onChange={(event) => setPhone(event.target.value)} />
          {errors.phone ? <FieldError id="patient-phone-hint">{errors.phone}</FieldError> : <p id="patient-phone-hint" className="mt-1 text-sm text-muted">Optional. Digits, spaces, plus, and dashes only.</p>}
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-ink">Gender</legend>
          <div className="flex flex-wrap gap-3">
            {GENDERS.map((item) => (
              <label key={item} className="inline-flex min-h-10 items-center gap-2">
                <input type="radio" name="gender" className="size-5" checked={gender === item} onChange={() => setGender(item)} />
                {item}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-ink">Marital status</legend>
          <div className="flex flex-wrap gap-3">
            {MARITAL.map((item) => (
              <label key={item} className="inline-flex min-h-10 items-center gap-2">
                <input type="radio" name="marital" className="size-5" checked={maritalStatus === item} onChange={() => setMaritalStatus(item)} />
                {item}
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" loading={submitting}>Register patient</Button>
      </form>

      <Dialog open={Boolean(duplicate)} title="Patient already registered" onClose={() => setDuplicate(null)}>
        {duplicate ? (
          <div className="flex flex-col gap-3">
            <p>{duplicate.name}{duplicate.patient_code ? ` · ${duplicate.patient_code}` : ""}{duplicate.phone ? ` · ${duplicate.phone}` : ""}</p>
            <p className="text-sm text-muted">Use the existing record, register another patient with this phone, or cancel.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  const existing = duplicate;
                  setDuplicate(null);
                  navigate(`/reception/book?patient_id=${existing.patient_id}&name=${encodeURIComponent(existing.name)}&patient_code=${encodeURIComponent(existing.patient_code || "")}`);
                }}
              >
                Use existing
              </Button>
              <Button variant="secondary" loading={submitting} onClick={() => void submit(true)}>Register anyway</Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(created)}
        title="Patient registered"
        onClose={() => {
          setCreated(null);
          resetForm();
        }}
      >
        {created ? (
          <div className="flex flex-col gap-2">
            <p>{created.name} · {created.patient_code || "—"}</p>
            <p>Username: {created.username || "—"}</p>
            <p>Temporary password: {created.temp_password || "—"}</p>
            <p className="text-sm text-muted">These credentials are shown once.</p>
            <Link
              className="mt-2 inline-flex min-h-10 items-center font-semibold text-primary-hover"
              to={`/reception/book?patient_id=${created.patient_id}&name=${encodeURIComponent(created.name)}&patient_code=${encodeURIComponent(created.patient_code || "")}`}
            >
              Book appointment
            </Link>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

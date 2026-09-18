from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional, Tuple
import os, datetime, re, json
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from database import engine, get_db, Base
import models, schemas
from auth import get_password_hash, verify_password
from sqlalchemy import func
from ai_pipeline import run_pipeline


# Initialize Database
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MedScribe AI Professional API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ====================== SOAP PARSER HELPERS ======================

def clean_markdown(text: str) -> str:
    """
    ## headings, **bold**, *italic* symbols remove karo — content preserve karo.
    """
    if not text:
        return text
    # Remove ### heading markers
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    # Remove **bold** and __bold__ markers (keep inner text)
    text = re.sub(r'\*{1,2}([^*\n]+)\*{1,2}', r'\1', text)
    text = re.sub(r'_{1,2}([^_\n]+)_{1,2}', r'\1', text)
    # Cleanup extra blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def parse_soap_sections(soap_text: str) -> dict:
    """
    SOAP note text ko parse karke S, O, A, P alag fields mein extract karo.
    Returns dict with keys: subjective, objective, assessment, plan

    Handles formats:
      - **Subjective**:   Subjective:   SUBJECTIVE:
      - ### FINAL OUTPUT: **S** - Subjective:   (AI preamble format)
      - S - Subjective:   O - Objective:
      - Simple: Subjective\n content...
    """
    sections = {
        "subjective": "",
        "objective":  "",
        "assessment": "",
        "plan":       "",
    }

    # Unified header regex:
    # Matches entire header line regardless of preamble (###, FINAL OUTPUT, etc.)
    # Captures section name: Subjective / Objective / Assessment / Plan
    header_re = re.compile(
        r'(?:^|\n)'                                          # line start
        r'[^\n]*?'                                           # optional preamble
        r'\*{0,2}'                                           # optional **
        r'(Subjective|Objective|Assessment|Plan)'            # section keyword
        r'\*{0,2}'                                           # optional **
        r'[^\n]*'                                            # rest of header (colon, dash, etc.)
        r'\n',                                               # end of header line
        re.IGNORECASE
    )

    matches = list(header_re.finditer(soap_text))

    for i, match in enumerate(matches):
        section_name = match.group(1).lower()
        content_start = match.end()
        content_end = matches[i + 1].start() if i + 1 < len(matches) else len(soap_text)
        content = soap_text[content_start:content_end].strip()
        sections[section_name] = clean_markdown(content)

    # Fallback: agar koi section parse nahi hua, sara text subjective mein
    if not any(sections.values()):
        sections["subjective"] = clean_markdown(soap_text.strip())

    return sections


_CLINICAL_SUMMARY_MAX = 800


def build_clinical_summary(
    subjective: Optional[str] = None,
    objective: Optional[str] = None,
    assessment: Optional[str] = None,
    plan: Optional[str] = None,
    max_chars: int = _CLINICAL_SUMMARY_MAX,
) -> Optional[str]:
    """
    Deterministic short summary from approved S/O/A/P only.
    Does not invent or infer clinical content. Returns None if all empty.
    """
    def _clip_section(text: Optional[str], budget: int) -> Optional[str]:
        if not text:
            return None
        cleaned = " ".join(str(text).split())
        if not cleaned:
            return None
        if len(cleaned) <= budget:
            return cleaned
        return cleaned[: max(0, budget - 1)].rstrip() + "…"

    # Soft budgets so Assessment/Plan are not crowded out by long Subjective
    budgets = {
        "Subjective": 220,
        "Objective": 150,
        "Assessment": 200,
        "Plan": 230,
    }
    pieces = []
    for label, raw in (
        ("Subjective", subjective),
        ("Objective", objective),
        ("Assessment", assessment),
        ("Plan", plan),
    ):
        clipped = _clip_section(raw, budgets[label])
        if clipped:
            pieces.append(f"{label}: {clipped}")

    if not pieces:
        return None

    summary = " | ".join(pieces)
    if len(summary) <= max_chars:
        return summary

    # Hard cap while keeping as many leading sections as fit
    out = []
    used = 0
    for piece in pieces:
        sep = 3 if out else 0  # " | "
        if used + sep + len(piece) > max_chars:
            remain = max_chars - used - sep
            if remain >= 40:
                out.append(piece[: remain - 1].rstrip() + "…")
            break
        out.append(piece)
        used += sep + len(piece)
    return " | ".join(out) if out else summary[: max_chars - 1].rstrip() + "…"


def _latest_clinical_summary_for_patient(db: Session, patient_id: int) -> Optional[str]:
    """Latest completed visit's soap_reports.clinical_summary (may be NULL)."""
    appointments = (
        db.query(models.Appointment)
        .filter(models.Appointment.patient_id == patient_id)
        .order_by(
            models.Appointment.scheduled_time.desc().nullslast(),
            models.Appointment.created_at.desc(),
        )
        .all()
    )
    for appt in appointments:
        consultation = appt.consultation
        if not consultation:
            continue
        if (consultation.status or "").lower() != "completed":
            continue
        report = consultation.soap_report
        if report is None:
            return None
        return report.clinical_summary
    return None


# ====================== AUTH & ADMIN ENDPOINTS ======================

@app.post("/login")
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    # Accept either email or username in the same field
    user = db.query(models.User).filter(
        (models.User.email == request.email) | (models.User.username == request.email)
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email/username or password")
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password")

    user_response = {
        "user_id": user.user_id,
        "name":    user.name,
        "email":   user.email,
        "role":    user.role.lower()
    }

    # Attach role-specific profile IDs so the frontend can use them later
    if user.role.lower() == "receptionist" and user.receptionist_profile:
        user_response["receptionist_id"] = user.receptionist_profile.receptionist_id
    elif user.role.lower() == "doctor" and user.doctor_profile:
        user_response["doctor_id"] = user.doctor_profile.doctor_id

    return {
        "status": "success",
        "user": user_response
    }


@app.post("/admin/add-doctor")
def add_doctor(doctor_in: schemas.DoctorCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(
        models.User.email == doctor_in.user_data.email
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pwd = get_password_hash(doctor_in.user_data.password)

    new_user = models.User(
        name=doctor_in.user_data.name,
        email=doctor_in.user_data.email,
        username=doctor_in.user_data.username,
        password_hash=hashed_pwd,
        phone=doctor_in.user_data.phone,
        role="doctor"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    new_doctor = models.Doctor(
        user_id=new_user.user_id,
        specialization=doctor_in.specialization,
        experience_years=doctor_in.experience_years,
        availability_status=doctor_in.availability_status,
    )
    db.add(new_doctor)
    db.commit()
    db.refresh(new_doctor)

    if doctor_in.schedule:
        db.add(models.MedicalDocument(
            title=f"doctor_schedule_{new_doctor.doctor_id}",
            content=json.dumps(doctor_in.schedule),
            source="doctor_schedule",
        ))
        db.commit()

    return {
        "status":    "success",
        "message":   "Doctor created successfully",
        "doctor_id": new_doctor.doctor_id,
        "user_id":   new_user.user_id
    }


@app.post("/admin/add-receptionist")
def add_receptionist(recept_in: schemas.ReceptionistCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(
        models.User.email == recept_in.user_data.email
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_username = db.query(models.User).filter(
        models.User.username == recept_in.user_data.username
    ).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    hashed_pwd = get_password_hash(recept_in.user_data.password)

    new_user = models.User(
        name=recept_in.user_data.name,
        email=recept_in.user_data.email,
        username=recept_in.user_data.username,
        password_hash=hashed_pwd,
        phone=recept_in.user_data.phone,
        role="receptionist"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    new_recept = models.Receptionist(user_id=new_user.user_id)
    db.add(new_recept)
    db.commit()
    db.refresh(new_recept)

    return {
        "status": "success",
        "message": "Receptionist profile created successfully",
        "receptionist_id": new_recept.receptionist_id,
        "user_id": new_user.user_id,
    }


@app.get("/receptionists", response_model=List[schemas.ReceptionistResponse])
def get_receptionists(db: Session = Depends(get_db)):
    receptionists = db.query(models.Receptionist).all()
    return [
        schemas.ReceptionistResponse(
            receptionist_id=r.receptionist_id,
            user_id=r.user_id,
            name=r.user.name if r.user else "",
            email=r.user.email if r.user else "",
            username=r.user.username if r.user else "",
            phone=r.user.phone if r.user else None,
        )
        for r in receptionists
    ]


@app.get("/receptionists/{receptionist_id}", response_model=schemas.ReceptionistDetailResponse)
def get_receptionist(receptionist_id: int, db: Session = Depends(get_db)):
    receptionist = db.query(models.Receptionist).filter(
        models.Receptionist.receptionist_id == receptionist_id
    ).first()

    if not receptionist or not receptionist.user:
        raise HTTPException(status_code=404, detail="Receptionist not found")

    return schemas.ReceptionistDetailResponse(
        receptionist_id=receptionist.receptionist_id,
        user_id=receptionist.user_id,
        name=receptionist.user.name,
        email=receptionist.user.email,
        username=receptionist.user.username,
        phone=receptionist.user.phone,
        created_at=receptionist.user.created_at,
    )


@app.put("/receptionists/{receptionist_id}", response_model=schemas.ReceptionistDetailResponse)
def update_receptionist(
    receptionist_id: int,
    recept_in: schemas.ReceptionistUpdate,
    db: Session = Depends(get_db),
):
    receptionist = db.query(models.Receptionist).filter(
        models.Receptionist.receptionist_id == receptionist_id
    ).first()

    if not receptionist or not receptionist.user:
        raise HTTPException(status_code=404, detail="Receptionist not found")

    user = receptionist.user

    if recept_in.email and recept_in.email != user.email:
        existing_email = db.query(models.User).filter(
            models.User.email == recept_in.email,
            models.User.user_id != user.user_id,
        ).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = recept_in.email

    if recept_in.username and recept_in.username != user.username:
        existing_username = db.query(models.User).filter(
            models.User.username == recept_in.username,
            models.User.user_id != user.user_id,
        ).first()
        if existing_username:
            raise HTTPException(status_code=400, detail="Username already taken")
        user.username = recept_in.username

    if recept_in.name is not None:
        user.name = recept_in.name
    if recept_in.phone is not None:
        user.phone = recept_in.phone
    if recept_in.password:
        user.password_hash = get_password_hash(recept_in.password)

    db.commit()
    db.refresh(user)

    return schemas.ReceptionistDetailResponse(
        receptionist_id=receptionist.receptionist_id,
        user_id=user.user_id,
        name=user.name,
        email=user.email,
        username=user.username,
        phone=user.phone,
        created_at=user.created_at,
    )


@app.delete("/receptionists/{receptionist_id}")
def delete_receptionist(receptionist_id: int, db: Session = Depends(get_db)):
    receptionist = db.query(models.Receptionist).filter(
        models.Receptionist.receptionist_id == receptionist_id
    ).first()

    if not receptionist:
        raise HTTPException(status_code=404, detail="Receptionist not found")

    user_id = receptionist.user_id

    db.query(models.Patient).filter(
        models.Patient.registered_by == receptionist_id
    ).update({models.Patient.registered_by: None}, synchronize_session=False)

    db.delete(receptionist)

    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if user:
        db.delete(user)

    db.commit()

    return {
        "status": "success",
        "message": "Receptionist deleted permanently",
        "receptionist_id": receptionist_id,
    }


@app.get("/doctors", response_model=List[schemas.DoctorResponse])
def get_doctors(db: Session = Depends(get_db)):
    doctors = db.query(models.Doctor).all()
    return [
        schemas.DoctorResponse(
            doctor_id=d.doctor_id,
            user_id=d.user_id,
            name=d.user.name if d.user else "",
            specialization=d.specialization,
            experience_years=d.experience_years,
            availability_status=d.availability_status,
        )
        for d in doctors
    ]


@app.get("/doctors/{doctor_id}", response_model=schemas.DoctorDetailResponse)
def get_doctor(doctor_id: int, db: Session = Depends(get_db)):
    doctor = db.query(models.Doctor).filter(
        models.Doctor.doctor_id == doctor_id
    ).first()

    if not doctor or not doctor.user:
        raise HTTPException(status_code=404, detail="Doctor not found")

    schedule: dict = {}
    schedule_doc = db.query(models.MedicalDocument).filter(
        models.MedicalDocument.title == f"doctor_schedule_{doctor_id}"
    ).first()
    if schedule_doc and schedule_doc.content:
        try:
            schedule = json.loads(schedule_doc.content)
        except json.JSONDecodeError:
            schedule = {}

    return schemas.DoctorDetailResponse(
        doctor_id=doctor.doctor_id,
        user_id=doctor.user_id,
        name=doctor.user.name,
        username=doctor.user.username,
        email=doctor.user.email,
        phone=doctor.user.phone,
        specialization=doctor.specialization,
        experience_years=doctor.experience_years,
        availability_status=doctor.availability_status,
        schedule=schedule,
    )


@app.put("/doctors/{doctor_id}", response_model=schemas.DoctorDetailResponse)
def update_doctor(
    doctor_id: int,
    doctor_in: schemas.DoctorUpdate,
    db: Session = Depends(get_db),
):
    doctor = db.query(models.Doctor).filter(
        models.Doctor.doctor_id == doctor_id
    ).first()

    if not doctor or not doctor.user:
        raise HTTPException(status_code=404, detail="Doctor not found")

    user = doctor.user

    if doctor_in.email and doctor_in.email != user.email:
        existing_email = db.query(models.User).filter(
            models.User.email == doctor_in.email,
            models.User.user_id != user.user_id,
        ).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = doctor_in.email

    if doctor_in.username and doctor_in.username != user.username:
        existing_username = db.query(models.User).filter(
            models.User.username == doctor_in.username,
            models.User.user_id != user.user_id,
        ).first()
        if existing_username:
            raise HTTPException(status_code=400, detail="Username already taken")
        user.username = doctor_in.username

    if doctor_in.name is not None:
        user.name = doctor_in.name
    if doctor_in.phone is not None:
        user.phone = doctor_in.phone
    if doctor_in.password:
        user.password_hash = get_password_hash(doctor_in.password)

    if doctor_in.specialization is not None:
        doctor.specialization = doctor_in.specialization
    if doctor_in.experience_years is not None:
        doctor.experience_years = doctor_in.experience_years

    if doctor_in.schedule is not None:
        schedule_title = f"doctor_schedule_{doctor_id}"
        schedule_doc = db.query(models.MedicalDocument).filter(
            models.MedicalDocument.title == schedule_title
        ).first()
        schedule_json = json.dumps(doctor_in.schedule)
        if schedule_doc:
            schedule_doc.content = schedule_json
        else:
            db.add(models.MedicalDocument(
                title=schedule_title,
                content=schedule_json,
                source="doctor_schedule",
            ))

    db.commit()
    db.refresh(user)
    db.refresh(doctor)

    schedule: dict = {}
    schedule_doc = db.query(models.MedicalDocument).filter(
        models.MedicalDocument.title == f"doctor_schedule_{doctor_id}"
    ).first()
    if schedule_doc and schedule_doc.content:
        try:
            schedule = json.loads(schedule_doc.content)
        except json.JSONDecodeError:
            schedule = {}

    return schemas.DoctorDetailResponse(
        doctor_id=doctor.doctor_id,
        user_id=doctor.user_id,
        name=user.name,
        username=user.username,
        email=user.email,
        phone=user.phone,
        specialization=doctor.specialization,
        experience_years=doctor.experience_years,
        availability_status=doctor.availability_status,
        schedule=schedule,
    )


@app.delete("/doctors/{doctor_id}")
def delete_doctor(doctor_id: int, db: Session = Depends(get_db)):
    doctor = db.query(models.Doctor).filter(
        models.Doctor.doctor_id == doctor_id
    ).first()

    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    user_id = doctor.user_id

    db.query(models.MedicalDocument).filter(
        models.MedicalDocument.title == f"doctor_schedule_{doctor_id}"
    ).delete(synchronize_session=False)

    db.query(models.Patient).filter(
        models.Patient.assigned_doctor_id == doctor_id
    ).update({models.Patient.assigned_doctor_id: None}, synchronize_session=False)

    consultations = db.query(models.Consultation).filter(
        models.Consultation.doctor_id == doctor_id
    ).all()
    for consultation in consultations:
        if consultation.transcription:
            db.delete(consultation.transcription)
        if consultation.soap_report:
            db.delete(consultation.soap_report)
        db.delete(consultation)

    appointments = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == doctor_id
    ).all()
    for appointment in appointments:
        if appointment.consultation:
            linked = appointment.consultation
            if linked.transcription:
                db.delete(linked.transcription)
            if linked.soap_report:
                db.delete(linked.soap_report)
            db.delete(linked)
        db.delete(appointment)

    db.delete(doctor)

    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if user:
        db.delete(user)

    db.commit()

    return {
        "status": "success",
        "message": "Doctor deleted permanently",
        "doctor_id": doctor_id,
    }


# ====================== AUDIO PROCESSING ======================

# Compact prior-visit budget for prior_clinical_context (keep small for MedGemma tokens)
_PRIOR_CTX_ASSESSMENT_MAX = 400
_PRIOR_CTX_PLAN_MAX = 400
_PRIOR_CTX_SO_MAX = 200
_PRIOR_CTX_NOTE_EXCERPT_MAX = 300
_PRIOR_CTX_TOTAL_MAX = 1400


def _clip_text(value: Optional[str], max_len: int) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def _build_prior_clinical_context(
    db: Session,
    consultation: Optional[models.Consultation],
) -> Optional[dict]:
    """
    Latest ONE completed prior visit for the same patient as this consultation.
    patient_id is resolved only via consultation → appointment → patient_id.
    Returns None when unavailable. Never raises for missing data.
    """
    if consultation is None or consultation.appointment_id is None:
        return None

    current_appt = (
        db.query(models.Appointment)
        .filter(models.Appointment.appointment_id == consultation.appointment_id)
        .first()
    )
    if not current_appt or current_appt.patient_id is None:
        return None

    patient_id = current_appt.patient_id
    exclude_appointment_id = current_appt.appointment_id

    prior_appts = (
        db.query(models.Appointment)
        .filter(models.Appointment.patient_id == patient_id)
        .order_by(
            models.Appointment.scheduled_time.desc().nullslast(),
            models.Appointment.created_at.desc(),
        )
        .all()
    )

    chosen = None
    for appt in prior_appts:
        if appt.appointment_id == exclude_appointment_id:
            continue
        linked = appt.consultation
        if linked is None:
            continue
        if (linked.status or "").lower().strip() != "completed":
            continue
        chosen = appt
        break

    if chosen is None:
        return None

    linked = chosen.consultation
    doctor_name = None
    if chosen.doctor and chosen.doctor.user:
        doctor_name = chosen.doctor.user.name

    assessment = None
    plan = None
    subjective = None
    objective = None
    soap_note_excerpt = None

    report = linked.soap_report if linked else None
    if report:
        assessment = report.assessment
        plan = report.plan
        subjective = report.subjective
        objective = report.objective
    elif linked and linked.soap_note:
        parsed = parse_soap_sections(linked.soap_note)
        assessment = parsed.get("assessment")
        plan = parsed.get("plan")
        subjective = parsed.get("subjective")
        objective = parsed.get("objective")

    assessment = _clip_text(assessment, _PRIOR_CTX_ASSESSMENT_MAX)
    plan = _clip_text(plan, _PRIOR_CTX_PLAN_MAX)
    subjective = _clip_text(subjective, _PRIOR_CTX_SO_MAX)
    objective = _clip_text(objective, _PRIOR_CTX_SO_MAX)

    if not assessment and not plan and linked and linked.soap_note:
        soap_note_excerpt = _clip_text(linked.soap_note, _PRIOR_CTX_NOTE_EXCERPT_MAX)

    visit = {
        "appointment_id": chosen.appointment_id,
        "scheduled_time": (
            chosen.scheduled_time.isoformat() if chosen.scheduled_time is not None else None
        ),
        "doctor_name": doctor_name,
        "assessment": assessment,
        "plan": plan,
        "subjective": subjective,
        "objective": objective,
        "soap_note_excerpt": soap_note_excerpt,
    }

    # Drop empty optional clinical fields to keep payload small
    visit = {k: v for k, v in visit.items() if v is not None and v != ""}

    context = {
        "patient_id": patient_id,
        "exclude_appointment_id": exclude_appointment_id,
        "visits": [visit],
    }

    # Hard cap on serialized size
    encoded = json.dumps(context, default=str)
    if len(encoded) > _PRIOR_CTX_TOTAL_MAX:
        # Prefer Assessment/Plan; drop S/O/excerpt first
        visit.pop("subjective", None)
        visit.pop("objective", None)
        visit.pop("soap_note_excerpt", None)
        context["visits"] = [visit]
        encoded = json.dumps(context, default=str)
        if len(encoded) > _PRIOR_CTX_TOTAL_MAX:
            if "assessment" in visit:
                visit["assessment"] = _clip_text(visit["assessment"], 200)
            if "plan" in visit:
                visit["plan"] = _clip_text(visit["plan"], 200)
            context["visits"] = [visit]

    return context


async def call_colab_in_background(consultation_id: int, audio_url: str, bucket_path: str):
    # Own session: request-scoped get_db() is closed before BackgroundTasks run.
    from database import SessionLocal
    db = SessionLocal()

    print(f"🔥 Task started: {consultation_id}")
    print(f"🔥 Audio URL: {audio_url}")

    consultation = None
    try:
        consultation = db.query(models.Consultation).filter(
            models.Consultation.consultation_id == consultation_id
        ).first()

        if consultation:
            consultation.status           = "processing"
            consultation.processing_step  = "started"
            consultation.progress_message = "Connecting to the AI processing service..."
            consultation.updated_at       = datetime.datetime.utcnow()
            db.commit()

        prior_clinical_context = None
        try:
            prior_clinical_context = _build_prior_clinical_context(db, consultation)
        except Exception as hist_err:
            # History must never fail the audio job
            print(f"⚠️ prior_clinical_context skipped: {hist_err}")
            prior_clinical_context = None

        # Local AI pipeline writes progress + final result to consultations itself.
        result = await run_pipeline(
            consultation_id=consultation_id,
            audio_url=audio_url,
            bucket_path=bucket_path,
            prior_clinical_context=prior_clinical_context,
            db=db,
        )

        # Do not overwrite a successful (or already-persisted error) pipeline write.
        if isinstance(result, dict) and result.get("status") == "error":
            print(f"Pipeline returned error: {result.get('message')}")

    except Exception as e:
        error_msg = str(e)
        print(f"Pipeline call failed: {error_msg}")
        if consultation:
            consultation.status        = "error"
            consultation.error_message = error_msg
            consultation.updated_at    = datetime.datetime.utcnow()
            db.commit()

    finally:
        db.close()


@app.post("/consultation/process-audio")
async def process_audio(
    request: schemas.AudioProcessRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # Optional appointment link (backward-compatible: may be None)
    appointment_id = request.appointment_id
    if appointment_id is not None:
        appt = db.query(models.Appointment).filter(
            models.Appointment.appointment_id == appointment_id
        ).first()
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found")

    new_consultation = models.Consultation(
        appointment_id=appointment_id,
        doctor_id=request.doctor_id,
        audio_recording_url=request.audio_url,
        audio_file_path=request.audio_file_path,
        file_name=request.file_name,
        status="queued",
        processing_step="queued",
        progress_message="Queued for processing",
    )
    db.add(new_consultation)
    db.commit()
    db.refresh(new_consultation)

    background_tasks.add_task(
        call_colab_in_background,
        consultation_id=new_consultation.consultation_id,
        audio_url=request.audio_url,
        bucket_path=request.audio_file_path
    )

    return {
        "status":          "queued",
        "consultation_id": new_consultation.consultation_id,
        "appointment_id":  new_consultation.appointment_id,
        "message":         "Audio queued successfully. Processing will start shortly."
    }


@app.get("/consultation/{consultation_id}/status")
def get_consultation_status(consultation_id: int, db: Session = Depends(get_db)):
    consultation = db.query(models.Consultation).filter(
        models.Consultation.consultation_id == consultation_id
    ).first()

    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    response = {
        "consultation_id":  consultation.consultation_id,
        "status":           consultation.status,
        "file_name":        consultation.file_name,
        "created_at":       consultation.created_at,
        "updated_at":       consultation.updated_at,
        "error_message":    consultation.error_message,
        "processing_step":  getattr(consultation, 'processing_step', None),
        "progress_message": getattr(consultation, 'progress_message', None),
        "progress_percent": getattr(consultation, 'progress_percent', 0),
        "appointment_id":   consultation.appointment_id,
    }

    if consultation.status in ("pending_approval", "completed", "rejected"):
        response["soap_note"]  = consultation.soap_note
        response["transcript"] = consultation.transcript

    return response


@app.get("/consultation/{consultation_id}/soap")
def get_soap_note(consultation_id: int, db: Session = Depends(get_db)):
    consultation = db.query(models.Consultation).filter(
        models.Consultation.consultation_id == consultation_id
    ).first()

    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    if consultation.status != "completed":
        raise HTTPException(
            status_code=202,
            detail="Your consultation is still being processed. Please wait."
        )

    return {
        "consultation_id": consultation.consultation_id,
        "status":          consultation.status,
        "soap_note":       consultation.soap_note,
        "transcript":      consultation.transcript,
        "file_name":       consultation.file_name,
        "created_at":      consultation.created_at,
    }


@app.get("/consultation/{consultation_id}/soap-report")
def get_soap_report_detail(consultation_id: int, db: Session = Depends(get_db)):
    """
    soap_reports table se parsed S/O/A/P sections return karo.
    Doctor dashboard ke liye — structured alag-alag fields mein.
    """
    report = db.query(models.SOAPReport).filter(
        models.SOAPReport.consultation_id == consultation_id
    ).first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="SOAP report not found. The consultation has not been approved yet, or it does not exist."
        )

    return {
        "soap_id":         report.soap_id,
        "consultation_id": report.consultation_id,
        "subjective":      report.subjective,
        "objective":       report.objective,
        "assessment":      report.assessment,
        "plan":            report.plan,
        "full_soap_note":  report.full_soap_note,
        "generated_at":    report.generated_at,
    }


# ====================== DOCTOR APPROVE / REJECT ENDPOINTS ======================

@app.post("/consultation/{consultation_id}/approve")
def approve_soap_note(
    consultation_id: int,
    request: schemas.ApproveSOAPRequest,
    db: Session = Depends(get_db)
):
    """
    Doctor SOAP note review/edit karta hai phir approve karta hai.

    Steps:
      1. consultations table  → status='completed', soap_note=doctor ka final version
      2. parse_soap_sections  → S, O, A, P text extract karo (markdown cleaned)
      3. soap_reports table   → UPSERT (update if exists, insert if new)
    All in one DB transaction.
    """
    consultation = db.query(models.Consultation).filter(
        models.Consultation.consultation_id == consultation_id
    ).first()

    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    if consultation.status not in ("pending_approval", "completed"):
        raise HTTPException(
            status_code=400,
            detail="The SOAP note cannot be approved in its current status."
        )

    final_soap = request.approved_soap
    consultation.status           = "completed"
    consultation.soap_note        = final_soap
    consultation.processing_step  = "completed"
    consultation.progress_message = "SOAP note approved by the doctor."
    if request.doctor_id:
        consultation.doctor_id = request.doctor_id
    consultation.updated_at = datetime.datetime.utcnow()

    # Complete linked OPD visit when SOAP is approved
    if consultation.appointment_id:
        appt = db.query(models.Appointment).filter(
            models.Appointment.appointment_id == consultation.appointment_id
        ).first()
        if appt and appt.status == "in_progress":
            appt.status = "completed"

    parsed = parse_soap_sections(final_soap)

    existing_report = db.query(models.SOAPReport).filter(
        models.SOAPReport.consultation_id == consultation_id
    ).first()

    if existing_report:
        existing_report.subjective     = parsed["subjective"]
        existing_report.objective      = parsed["objective"]
        existing_report.assessment     = parsed["assessment"]
        existing_report.plan           = parsed["plan"]
        existing_report.full_soap_note = final_soap
        existing_report.generated_at   = datetime.datetime.utcnow()
        report_row = existing_report
        print(f"✅ soap_reports UPDATED  — consultation_id={consultation_id}")
    else:
        new_report = models.SOAPReport(
            consultation_id=consultation_id,
            subjective=parsed["subjective"],
            objective=parsed["objective"],
            assessment=parsed["assessment"],
            plan=parsed["plan"],
            full_soap_note=final_soap,
            generated_at=datetime.datetime.utcnow(),
        )
        db.add(new_report)
        report_row = new_report
        print(f"✅ soap_reports INSERTED — consultation_id={consultation_id}")

    # Persist short clinical summary without blocking approval on failure
    try:
        summary = build_clinical_summary(
            parsed.get("subjective"),
            parsed.get("objective"),
            parsed.get("assessment"),
            parsed.get("plan"),
        )
        report_row.clinical_summary = summary
    except Exception as summary_err:
        print(
            f"⚠️ clinical_summary skipped for consultation_id={consultation_id}: "
            f"{summary_err}"
        )

    db.commit()

    return {
        "status":          "completed",
        "consultation_id": consultation_id,
        "message":         "SOAP note approved, finalized, and saved successfully.",
        "soap_sections": {
            "subjective": parsed["subjective"],
            "objective":  parsed["objective"],
            "assessment": parsed["assessment"],
            "plan":       parsed["plan"],
        }
    }


@app.post("/consultation/{consultation_id}/reject")
def reject_soap_note(
    consultation_id: int,
    reason: Optional[str] = "",
    db: Session = Depends(get_db)
):
    """
    Doctor ne SOAP note reject kia — status = 'rejected'.
    """
    consultation = db.query(models.Consultation).filter(
        models.Consultation.consultation_id == consultation_id
    ).first()

    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    consultation.status           = "rejected"
    consultation.processing_step  = "rejected"
    consultation.progress_message = f"Rejected by doctor: {reason or 'No reason given'}"
    consultation.error_message    = reason or "Doctor rejected this SOAP note"
    consultation.updated_at       = datetime.datetime.utcnow()
    db.commit()

    return {
        "status":          "rejected",
        "consultation_id": consultation_id,
        "message":         "SOAP note rejected."
    }


@app.get("/doctor/{doctor_id}/consultations")
def get_doctor_consultations(doctor_id: int, db: Session = Depends(get_db)):
    consultations = db.query(models.Consultation).filter(
        models.Consultation.doctor_id == doctor_id
    ).order_by(models.Consultation.created_at.desc()).all()

    return [
        {
            "consultation_id": c.consultation_id,
            "file_name":       c.file_name,
            "status":          c.status,
            "created_at":      c.created_at,
            "has_soap":        c.soap_note is not None,
        }
        for c in consultations
    ]


# ====================== APPOINTMENT / VISIT ENDPOINTS ======================

APPOINTMENT_STATUSES = {"scheduled", "waiting", "in_progress", "completed", "cancelled"}

# Minimal allowed transitions for OPD visit flow
APPOINTMENT_TRANSITIONS = {
    "scheduled":   {"waiting", "cancelled"},
    "waiting":     {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed":   set(),
    "cancelled":   set(),
}

# Clinical handoff — doctor (or admin) only
DOCTOR_ONLY_STATUS_TRANSITIONS = {
    ("waiting", "in_progress"),
    ("in_progress", "completed"),
}

# Matches frontend src/utils/doctorSlots.ts
APPOINTMENT_SLOT_MINUTES = 30
# Clinic wall-clock for schedule / past / OPD-vs-future checks (server clock, not client)
CLINIC_TZ_NAME = os.environ.get("CLINIC_TZ", "Asia/Karachi")
# JS getDay() order used by doctor schedule keys
_SCHEDULE_DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
_TIME_RANGE_RE = re.compile(
    r"^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)\s*-\s*(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$",
    re.IGNORECASE,
)


def _clinic_tz():
    """Clinic wall-clock TZ. Prefers IANA; falls back if tzdata is missing (e.g. some Windows)."""
    try:
        return ZoneInfo(CLINIC_TZ_NAME)
    except ZoneInfoNotFoundError:
        # Common clinic defaults when the OS/Python tz database is unavailable
        if CLINIC_TZ_NAME in ("Asia/Karachi", "PKT"):
            return datetime.timezone(datetime.timedelta(hours=5), name="Asia/Karachi")
        if CLINIC_TZ_NAME in ("Asia/Calcutta", "Asia/Kolkata"):
            return datetime.timezone(datetime.timedelta(hours=5, minutes=30), name=CLINIC_TZ_NAME)
        raise HTTPException(
            status_code=500,
            detail=(
                f"Unknown clinic timezone '{CLINIC_TZ_NAME}'. "
                "Install the 'tzdata' package or set CLINIC_TZ to a supported zone."
            ),
        )


def _as_utc_aware(dt: datetime.datetime) -> datetime.datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc)


def _to_clinic_local(dt: datetime.datetime) -> datetime.datetime:
    return _as_utc_aware(dt).astimezone(_clinic_tz())


def _store_naive_utc_minute(dt: datetime.datetime) -> datetime.datetime:
    """Persist UTC wall time as naive timestamp (matches existing client ISO storage)."""
    return _as_utc_aware(dt).replace(tzinfo=None, second=0, microsecond=0)


def _clinic_day_utc_naive_bounds(date_str: str) -> Tuple[datetime.datetime, datetime.datetime]:
    """
    Convert a clinic calendar date (YYYY-MM-DD in CLINIC_TZ) to UTC-naive
    [start, end) bounds for comparing against stored UTC-naive scheduled_time.
    """
    day = datetime.datetime.strptime(date_str, "%Y-%m-%d")
    start_local = day.replace(tzinfo=_clinic_tz())
    end_local = start_local + datetime.timedelta(days=1)
    start_utc = start_local.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    end_utc = end_local.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return start_utc, end_utc


def _clinic_day_utc_naive_bounds_for_instant(
    scheduled_utc_naive: datetime.datetime,
) -> Tuple[datetime.datetime, datetime.datetime]:
    local = _to_clinic_local(scheduled_utc_naive)
    return _clinic_day_utc_naive_bounds(local.strftime("%Y-%m-%d"))


def _parse_clock_to_minutes(clock: str) -> Optional[int]:
    m = re.match(r"^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$", clock.strip(), re.IGNORECASE)
    if not m:
        return None
    hour = int(m.group(1))
    minute = int(m.group(2))
    period = m.group(3).upper()
    if period == "AM":
        if hour == 12:
            hour = 0
    elif hour != 12:
        hour += 12
    return hour * 60 + minute


def _parse_schedule_range(range_str: str) -> Optional[Tuple[int, int]]:
    trimmed = range_str.strip()
    if not _TIME_RANGE_RE.match(trimmed):
        return None
    parts = re.split(r"\s*-\s*", trimmed)
    if len(parts) != 2:
        return None
    start = _parse_clock_to_minutes(parts[0])
    end = _parse_clock_to_minutes(parts[1])
    if start is None or end is None or end <= start:
        return None
    return start, end


def _load_doctor_schedule(db: Session, doctor_id: int) -> dict:
    schedule_doc = (
        db.query(models.MedicalDocument)
        .filter(models.MedicalDocument.title == f"doctor_schedule_{doctor_id}")
        .first()
    )
    if not schedule_doc or not schedule_doc.content:
        return {}
    try:
        data = json.loads(schedule_doc.content)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def _schedule_day_key(local_dt: datetime.datetime) -> str:
    # Match JS Date#getDay / frontend doctorSlots weekday keys
    js_day = (local_dt.weekday() + 1) % 7
    return _SCHEDULE_DAY_KEYS[js_day]


def _clinic_now() -> datetime.datetime:
    """Server clock in clinic timezone — never trust the client clock."""
    return datetime.datetime.now(_clinic_tz())


def _validate_against_doctor_schedule(
    db: Session,
    doctor_id: int,
    scheduled_utc_naive: datetime.datetime,
    status: str,
) -> None:
    """
    Server-side schedule + clock checks (clinic TZ). Does not trust client clock.
    """
    now_clinic = _clinic_now()
    local = _to_clinic_local(scheduled_utc_naive)
    local_minutes = local.hour * 60 + local.minute

    # Status-specific date rules
    if status == "waiting":
        if local.date() != now_clinic.date():
            raise HTTPException(
                status_code=400,
                detail="Current OPD appointments must be booked for today's date (clinic time).",
            )
        if local <= now_clinic:
            raise HTTPException(
                status_code=400,
                detail="Cannot book a past time slot for Current OPD.",
            )
    elif status == "scheduled":
        if local.date() <= now_clinic.date():
            raise HTTPException(
                status_code=400,
                detail="Future appointments must be on a date after today (clinic time).",
            )

    schedule = _load_doctor_schedule(db, doctor_id)
    day_key = _schedule_day_key(local)
    range_str = schedule.get(day_key)
    if not range_str or not str(range_str).strip():
        raise HTTPException(
            status_code=400,
            detail=f"Doctor is not scheduled on {day_key}.",
        )

    parsed = _parse_schedule_range(str(range_str))
    if not parsed:
        raise HTTPException(
            status_code=400,
            detail=f"Doctor schedule for {day_key} is invalid.",
        )
    start, end = parsed

    if local_minutes < start or local_minutes >= end:
        raise HTTPException(
            status_code=400,
            detail=f"Selected time is outside doctor working hours ({range_str}).",
        )

    # Must land on a slot start (same grid as frontend)
    if (local_minutes - start) % APPOINTMENT_SLOT_MINUTES != 0:
        raise HTTPException(
            status_code=400,
            detail=f"Selected time must align to a {APPOINTMENT_SLOT_MINUTES}-minute slot.",
        )
    if local_minutes + APPOINTMENT_SLOT_MINUTES > end:
        raise HTTPException(
            status_code=400,
            detail="Selected slot does not fit within doctor working hours.",
        )

    # Current OPD: doctor must currently be within working hours (server clock)
    if status == "waiting":
        now_mins = now_clinic.hour * 60 + now_clinic.minute
        if now_mins < start or now_mins >= end:
            raise HTTPException(
                status_code=400,
                detail="Doctor is outside working hours right now; cannot book Current OPD.",
            )


def _actor_from_user_id_header(
    db: Session,
    x_user_id: Optional[int],
) -> models.User:
    """
    Resolve the logged-in user from X-User-Id (set after /login).
    Role is taken from the database — not from a client-claimed role string.
    """
    if x_user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Send X-User-Id header from the logged-in session.",
        )
    user = db.query(models.User).filter(models.User.user_id == x_user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user session.")
    return user


def _assert_appointment_status_role(actor: models.User, current: str, new_status: str) -> None:
    """Enforce receptionist vs doctor boundaries on status changes."""
    if new_status == current:
        return

    role = (actor.role or "").lower().strip()
    pair = (current, new_status)

    if pair in DOCTOR_ONLY_STATUS_TRANSITIONS:
        if role not in ("doctor", "admin"):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Only a doctor can start or complete a consultation "
                    f"({current} → {new_status})."
                ),
            )
        return

    if new_status == "cancelled":
        if role not in ("receptionist", "doctor", "admin"):
            raise HTTPException(
                status_code=403,
                detail="Not allowed to cancel this appointment.",
            )
        return

    # e.g. scheduled → waiting (check-in / enter queue)
    if new_status == "waiting":
        if role not in ("receptionist", "doctor", "admin"):
            raise HTTPException(
                status_code=403,
                detail="Not allowed to move this appointment into the waiting queue.",
            )
        return

    if role not in ("doctor", "admin"):
        raise HTTPException(
            status_code=403,
            detail=f"Not allowed to change status from '{current}' to '{new_status}'.",
        )


def _generate_queue_token(db: Session) -> str:
    """Per-visit token: T-YYYYMMDD-NNN (unique for the day). Not patient_code."""
    today = datetime.datetime.utcnow().strftime("%Y%m%d")
    prefix = f"T-{today}-"
    count_today = db.query(models.Appointment).filter(
        models.Appointment.queue_token.like(f"{prefix}%")
    ).count()
    return f"{prefix}{str(count_today + 1).zfill(3)}"


def _appointment_response(appt: models.Appointment, db: Optional[Session] = None) -> dict:
    patient_name = appt.patient.name if appt.patient else None
    patient_code = appt.patient.patient_code if appt.patient else None
    department = appt.patient.department if appt.patient else None
    doctor_name = None
    doctor_specialization = None
    if appt.doctor and appt.doctor.user:
        doctor_name = appt.doctor.user.name
        doctor_specialization = appt.doctor.specialization
    elif db is not None and appt.doctor_id is not None:
        doctor = (
            db.query(models.Doctor)
            .filter(models.Doctor.doctor_id == appt.doctor_id)
            .first()
        )
        if doctor:
            doctor_specialization = doctor.specialization
            if doctor.user:
                doctor_name = doctor.user.name
    return {
        "appointment_id": appt.appointment_id,
        "patient_id": appt.patient_id,
        "doctor_id": appt.doctor_id,
        "scheduled_time": appt.scheduled_time,
        "status": appt.status,
        "queue_token": appt.queue_token,
        "created_at": appt.created_at,
        "patient_name": patient_name,
        "patient_code": patient_code,
        "doctor_name": doctor_name,
        "department": department,
        "doctor_specialization": doctor_specialization,
    }


@app.post("/appointments", response_model=schemas.AppointmentResponse)
def create_appointment(payload: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    """
    Book an OPD visit for an existing patient.
    Default status=waiting (current visit) → generates queue_token immediately.
    status=scheduled → future appointment, no token yet.

    Validates doctor schedule (day + hours), rejects past slots using clinic server time,
    and prevents double-booking (cancelled appointments do not block a slot).
    """
    status = (payload.status or "waiting").lower().strip()
    if status not in APPOINTMENT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{status}'. Allowed: {sorted(APPOINTMENT_STATUSES)}",
        )
    if status not in ("waiting", "scheduled"):
        raise HTTPException(
            status_code=400,
            detail="New appointments may only start as 'waiting' or 'scheduled'.",
        )

    patient = db.query(models.Patient).filter(
        models.Patient.patient_id == payload.patient_id
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor = db.query(models.Doctor).filter(
        models.Doctor.doctor_id == payload.doctor_id
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    if payload.scheduled_time is None:
        raise HTTPException(
            status_code=400,
            detail="scheduled_time is required.",
        )

    # Normalize to UTC-naive minute precision (consistent storage + conflict key)
    scheduled_time = _store_naive_utc_minute(payload.scheduled_time)

    # Schedule / past / OPD-vs-future (clinic TZ, server clock)
    _validate_against_doctor_schedule(db, payload.doctor_id, scheduled_time, status)

    # Application-level conflict check (cancelled does not block)
    # Use clinic calendar day bounds so evening PK slots are not split across UTC days
    day_start, day_end = _clinic_day_utc_naive_bounds_for_instant(scheduled_time)
    existing = (
        db.query(models.Appointment)
        .filter(
            models.Appointment.doctor_id == payload.doctor_id,
            models.Appointment.scheduled_time >= day_start,
            models.Appointment.scheduled_time < day_end,
            models.Appointment.status.isnot(None),
            models.Appointment.status != "cancelled",
        )
        .with_for_update()
        .all()
    )
    for other in existing:
        other_t = other.scheduled_time
        if other_t is None:
            continue
        if getattr(other_t, "tzinfo", None) is not None:
            other_t = other_t.replace(tzinfo=None)
        other_t = other_t.replace(second=0, microsecond=0)
        if other_t == scheduled_time:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This time slot is already booked for this doctor. "
                    "Please choose another available slot."
                ),
            )

    queue_token = None
    if status == "waiting":
        queue_token = _generate_queue_token(db)

    # Keep patient.assigned_doctor in sync with the booked appointment doctor
    patient.assigned_doctor_id = payload.doctor_id
    if status == "waiting":
        patient.status = "assigned"
    # Align patient department with the selected doctor's existing specialization
    if doctor.specialization and str(doctor.specialization).strip():
        patient.department = str(doctor.specialization).strip()

    try:
        appt = models.Appointment(
            patient_id=payload.patient_id,
            doctor_id=payload.doctor_id,
            scheduled_time=scheduled_time,
            status=status,
            queue_token=queue_token,
        )
        db.add(appt)
        db.commit()
        db.refresh(appt)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "This time slot is already booked for this doctor. "
                "Please choose another available slot."
            ),
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create appointment: {str(e)}")

    return _appointment_response(appt, db)


@app.get("/appointments", response_model=List[schemas.AppointmentResponse])
def list_appointments(
    date: Optional[str] = None,
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List appointments. Filters: date=YYYY-MM-DD, doctor_id, patient_id, status."""
    query = db.query(models.Appointment)

    if doctor_id is not None:
        query = query.filter(models.Appointment.doctor_id == doctor_id)
    if patient_id is not None:
        query = query.filter(models.Appointment.patient_id == patient_id)
    if status:
        query = query.filter(models.Appointment.status == status.lower().strip())
    if date:
        try:
            day_start, day_end = _clinic_day_utc_naive_bounds(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
        query = query.filter(
            models.Appointment.scheduled_time >= day_start,
            models.Appointment.scheduled_time < day_end,
        )

    appointments = query.order_by(
        models.Appointment.scheduled_time.asc().nullslast(),
        models.Appointment.created_at.asc(),
    ).all()

    return [_appointment_response(a, db) for a in appointments]


@app.patch("/appointments/{appointment_id}/status", response_model=schemas.AppointmentResponse)
def update_appointment_status(
    appointment_id: int,
    payload: schemas.AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    x_user_id: Optional[int] = Header(None, alias="X-User-Id"),
):
    """Update appointment status. Generates queue_token when entering waiting.

    Clinical transitions waiting→in_progress and in_progress→completed require Doctor.
    Cancellation remains allowed for receptionist/doctor/admin.
    """
    actor = _actor_from_user_id_header(db, x_user_id)

    appt = db.query(models.Appointment).filter(
        models.Appointment.appointment_id == appointment_id
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    new_status = payload.status.lower().strip()
    if new_status not in APPOINTMENT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{new_status}'. Allowed: {sorted(APPOINTMENT_STATUSES)}",
        )

    current = (appt.status or "scheduled").lower()
    allowed = APPOINTMENT_TRANSITIONS.get(current, set())
    if new_status != current and new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{current}' to '{new_status}'. Allowed: {sorted(allowed) or 'none'}",
        )

    _assert_appointment_status_role(actor, current, new_status)

    # Generate per-visit token when entering the waiting queue
    if new_status == "waiting" and not appt.queue_token:
        appt.queue_token = _generate_queue_token(db)

    appt.status = new_status
    try:
        db.commit()
        db.refresh(appt)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update status: {str(e)}")

    return _appointment_response(appt, db)


# ====================== RECEPTIONIST ENDPOINTS ======================

@app.post("/receptionist/register-patient", response_model=schemas.PatientResponse)
def register_patient(patient_in: schemas.PatientRegister, db: Session = Depends(get_db)):
    import secrets, string

    # Generate patient_code like P-2024-016 based on year + current count
    year = datetime.datetime.utcnow().year
    count_this_year = db.query(models.Patient).filter(
        models.Patient.patient_code.like(f"P-{year}-%")
    ).count()
    new_code = f"P-{year}-{str(count_this_year + 1).zfill(3)}"

    status_value = "assigned" if patient_in.assigned_doctor_id else "waiting"

    # ── Generate unique username: pat_<code_without_dashes> e.g. pat_P2024001 ──
    base_username = "pat_" + new_code.replace("-", "")
    username = base_username
    suffix = 1
    while db.query(models.User).filter(models.User.username == username).first():
        username = f"{base_username}_{suffix}"
        suffix += 1

    # ── Generate secure 10-char temporary password ──────────────────────────
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    temp_password = "".join(secrets.choice(alphabet) for _ in range(10))
    password_hash = get_password_hash(temp_password)

    # ── Determine email (optional) ───────────────────────────────────────────
    email = patient_in.email if patient_in.email else f"{username}@medscribe.local"

    # ── Single transaction: create User then Patient ─────────────────────────
    try:
        new_user = models.User(
            name=patient_in.name,
            username=username,
            email=email,
            password_hash=password_hash,
            phone=patient_in.phone,
            role="patient",
        )
        db.add(new_user)
        db.flush()  # get new_user.user_id without committing yet

        new_patient = models.Patient(
            user_id=new_user.user_id,
            name=patient_in.name,
            phone=patient_in.phone,
            patient_code=new_code,
            age=patient_in.age,
            gender=patient_in.gender,
            marital_status=patient_in.marital_status,
            department=patient_in.department,
            assigned_doctor_id=patient_in.assigned_doctor_id,
            registered_by=patient_in.registered_by,
            status=status_value,
        )
        db.add(new_patient)
        db.commit()
        db.refresh(new_patient)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

    # Return patient data + plaintext credentials (one-time, never stored)
    return {
        "patient_id": new_patient.patient_id,
        "name": new_patient.name,
        "patient_code": new_patient.patient_code,
        "department": new_patient.department,
        "status": new_patient.status,
        "created_at": new_patient.created_at,
        "username": username,
        "temp_password": temp_password,
    }


@app.get("/patients", response_model=List[schemas.PatientListResponse])
def search_patients(search: Optional[str] = "", db: Session = Depends(get_db)):
    query = db.query(models.Patient)

    if search:
        like_pattern = f"%{search}%"
        query = query.filter(
            (models.Patient.name.ilike(like_pattern)) |
            (models.Patient.patient_code.ilike(like_pattern)) |
            (models.Patient.phone.ilike(like_pattern))
        )

    patients = query.order_by(models.Patient.created_at.desc()).all()

    results = []
    for p in patients:
        visit_count = db.query(models.Appointment).filter(
            models.Appointment.patient_id == p.patient_id
        ).count()
        results.append({
            "patient_id": p.patient_id,
            "name": p.name,
            "patient_code": p.patient_code,
            "age": p.age,
            "phone": p.phone,
            "department": p.department,
            "status": p.status,
            "created_at": p.created_at,
            "visit_count": visit_count,
            "latest_clinical_summary": _latest_clinical_summary_for_patient(
                db, p.patient_id
            ),
        })

    return results


@app.get("/patients/{patient_id}/history", response_model=schemas.PatientHistoryResponse)
def get_patient_history(patient_id: int, db: Session = Depends(get_db)):
    """
    Longitudinal visit history for one patient (newest first).
    Includes approved SOAP when the linked consultation is completed.
    """
    patient = db.query(models.Patient).filter(
        models.Patient.patient_id == patient_id
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    appointments = (
        db.query(models.Appointment)
        .filter(models.Appointment.patient_id == patient_id)
        .order_by(
            models.Appointment.scheduled_time.desc().nullslast(),
            models.Appointment.created_at.desc(),
        )
        .all()
    )

    visits = []
    for appt in appointments:
        doctor_name = None
        if appt.doctor and appt.doctor.user:
            doctor_name = appt.doctor.user.name

        consultation = appt.consultation
        consultation_id = consultation.consultation_id if consultation else None
        consultation_status = consultation.status if consultation else None
        soap_note = None
        soap_sections = None
        clinical_summary = None

        if consultation and (consultation.status or "").lower() == "completed":
            soap_note = consultation.soap_note
            report = consultation.soap_report
            if report:
                soap_sections = {
                    "subjective": report.subjective,
                    "objective": report.objective,
                    "assessment": report.assessment,
                    "plan": report.plan,
                }
                clinical_summary = report.clinical_summary
            elif soap_note:
                parsed = parse_soap_sections(soap_note)
                soap_sections = {
                    "subjective": parsed.get("subjective"),
                    "objective": parsed.get("objective"),
                    "assessment": parsed.get("assessment"),
                    "plan": parsed.get("plan"),
                }

        visits.append({
            "appointment_id": appt.appointment_id,
            "scheduled_time": appt.scheduled_time,
            "doctor_id": appt.doctor_id,
            "doctor_name": doctor_name,
            "status": appt.status,
            "queue_token": appt.queue_token,
            "consultation_id": consultation_id,
            "consultation_status": consultation_status,
            "soap_note": soap_note,
            "soap_sections": soap_sections,
            "clinical_summary": clinical_summary,
        })

    return {
        "patient_id": patient.patient_id,
        "patient_name": patient.name,
        "patient_code": patient.patient_code,
        "visits": visits,
    }


@app.get("/patients/recent", response_model=List[schemas.PatientResponse])
def get_recent_patients(limit: int = 5, db: Session = Depends(get_db)):
    return db.query(models.Patient).order_by(
        models.Patient.created_at.desc()
    ).limit(limit).all()


@app.get("/patients/queue", response_model=List[schemas.QueuePatientResponse])
def get_patient_queue(db: Session = Depends(get_db)):
    patients = db.query(models.Patient).order_by(models.Patient.created_at.asc()).all()

    results = []
    for p in patients:
        doctor_name = None
        if p.assigned_doctor and p.assigned_doctor.user:
            doctor_name = p.assigned_doctor.user.name

        results.append({
            "patient_id": p.patient_id,
            "patient_code": p.patient_code,
            "name": p.name,
            "age": p.age,
            "gender": p.gender,
            "department": p.department,
            "status": p.status,
            "doctor_name": doctor_name,
            "created_at": p.created_at,
        })

    return results


@app.get("/dashboard/receptionist-stats", response_model=schemas.DashboardStatsResponse)
def get_receptionist_stats(db: Session = Depends(get_db)):
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    registered_today = db.query(models.Patient).filter(
        models.Patient.created_at >= today_start
    ).count()

    in_queue = db.query(models.Patient).filter(
        models.Patient.status == "waiting"
    ).count()

    appointments_today = db.query(models.Appointment).filter(
        models.Appointment.scheduled_time >= today_start
    ).count()

    return {
        "registered_today": registered_today,
        "in_queue": in_queue,
        "appointments_today": appointments_today,
        "avg_wait_minutes": None,  # needs real check-in/seen timestamps — skipping for now
    }


@app.get("/doctor/{doctor_id}/patients", response_model=List[schemas.PatientResponse])
def get_doctor_patients(doctor_id: int, db: Session = Depends(get_db)):
    return db.query(models.Patient).filter(
        models.Patient.assigned_doctor_id == doctor_id
    ).order_by(models.Patient.created_at.desc()).all()


# ====================== TEMPORARY ADMIN SETUP ======================

@app.post("/setup/create-admin")
def create_initial_admin(db: Session = Depends(get_db)):
    admin_exists = db.query(models.User).filter(models.User.role == "admin").first()
    if admin_exists:
        return {"message": "Admin already exists"}

    hashed_pwd = get_password_hash("admin786")

    new_admin = models.User(
        name="System Admin",
        email="admin@medscribe.com",
        username="admin",
        password_hash=hashed_pwd,
        phone="0000000000",
        role="admin"
    )
    db.add(new_admin)
    db.commit()

    return {"message": "Admin created!", "email": "admin@medscribe.com", "password": "admin786"}
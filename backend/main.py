from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import httpx, os, datetime, re, json
from database import engine, get_db, Base
import models, schemas
from auth import get_password_hash, verify_password
from sqlalchemy import func


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


# ====================== AUTH & ADMIN ENDPOINTS ======================

@app.post("/login")
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Email not registered")
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


# ====================== HELPER: Get Latest Colab URL ======================

def get_colab_url():
    return "https://unwell-duller-handshake.ngrok-free.dev"
    """Fetch latest ngrok URL from Supabase app_config table"""
    try:
        from supabase import create_client
        SUPABASE_URL = os.environ.get("SUPABASE_URL")
        SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
        if SUPABASE_URL and SUPABASE_KEY:
            supa = create_client(SUPABASE_URL, SUPABASE_KEY)
            response = supa.table("app_config").select("value").eq("key", "colab_url").execute()
            if response.data and len(response.data) > 0:
                return response.data[0]["value"]
    except Exception as e:
        print(f"Warning: Could not fetch colab_url from DB: {e}")

    return os.environ.get("COLAB_URL", "https://XXXX.ngrok-free.app")


# ====================== AUDIO PROCESSING ======================

async def call_colab_in_background(consultation_id: int, audio_url: str, bucket_path: str):
    from database import SessionLocal
    db = SessionLocal()

    COLAB_URL = get_colab_url()
    print(f"🔥 Task started: {consultation_id}")
    print(f"🔥 Colab URL: {COLAB_URL}")
    print(f"🔥 Audio URL: {audio_url}")

    consultation = None
    try:
        consultation = db.query(models.Consultation).filter(
            models.Consultation.consultation_id == consultation_id
        ).first()

        if consultation:
            consultation.status           = "processing"
            consultation.processing_step  = "started"
            consultation.progress_message = "Connecting to AI pipeline..."
            consultation.updated_at       = datetime.datetime.utcnow()
            db.commit()

        async with httpx.AsyncClient(timeout=900.0) as client:
            response = await client.post(
                f"{COLAB_URL}/process",
                json={
                    "audio_url":   audio_url,
                    "record_id":   str(consultation_id),
                    "bucket_path": bucket_path
                },
                timeout=900.0
            )
            response.raise_for_status()

    except httpx.TimeoutException:
        if consultation:
            consultation.status        = "error"
            consultation.error_message = "Processing timeout - Colab took too long"
            consultation.updated_at    = datetime.datetime.utcnow()
            db.commit()

    except Exception as e:
        error_msg = str(e)
        print(f"Colab call failed: {error_msg}")
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
    new_consultation = models.Consultation(
        appointment_id=None,
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
            detail=f"Still processing: {consultation.status}"
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
            detail="SOAP report not found. Consultation abhi approved nahi hua ya exist nahi karta."
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
            detail=f"Cannot approve — current status is: {consultation.status}"
        )

    final_soap = request.approved_soap
    consultation.status           = "completed"
    consultation.soap_note        = final_soap
    consultation.processing_step  = "completed"
    consultation.progress_message = "SOAP Note approved by doctor ✅"
    if request.doctor_id:
        consultation.doctor_id = request.doctor_id
    consultation.updated_at = datetime.datetime.utcnow()

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
        print(f"✅ soap_reports INSERTED — consultation_id={consultation_id}")

    db.commit()

    return {
        "status":          "completed",
        "consultation_id": consultation_id,
        "message":         "SOAP note approved, finalized, and saved to soap_reports ✅",
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


# ====================== RECEPTIONIST ENDPOINTS ======================

@app.post("/receptionist/register-patient", response_model=schemas.PatientResponse)
def register_patient(patient_in: schemas.PatientRegister, db: Session = Depends(get_db)):
    # Generate patient_code like P-2024-016 based on year + current count
    year = datetime.datetime.utcnow().year
    count_this_year = db.query(models.Patient).filter(
        models.Patient.patient_code.like(f"P-{year}-%")
    ).count()
    new_code = f"P-{year}-{str(count_this_year + 1).zfill(3)}"

    status_value = "assigned" if patient_in.assigned_doctor_id else "waiting"

    new_patient = models.Patient(
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
    return new_patient


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
        })

    return results


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
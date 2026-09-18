import { API_URL } from '@/src/config/api';
import { supabase } from '@/src/lib/supabase';
import {
  getPatientHistory,
  PatientHistoryVisit,
} from '@/src/services/patientService';
import { formatAppointmentDateTime } from '@/src/utils/doctorSlots';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─────────────────────────────────────────────────────────────
//   TYPES
// ─────────────────────────────────────────────────────────────
type UploadStatus =
  | 'idle' | 'uploading' | 'queued' | 'processing'
  | 'pending_approval' | 'completed' | 'rejected' | 'error';

const STATUS_MESSAGES: Record<UploadStatus, string> = {
  idle: '',
  uploading: 'Uploading audio...',
  queued: 'In queue — AI processing will begin shortly...',
  processing: 'Analyzing the consultation...',
  pending_approval: 'SOAP note is ready — opening review…',
  completed: 'SOAP note approved and finalized',
  rejected: 'SOAP note rejected',
  error: 'Processing failed. Please try again.',
};

/** Sequential checklist mapped from real backend processing_step values. */
const CHECKLIST_STEPS = [
  { key: 'uploaded', label: 'Audio uploaded' },
  { key: 'audio', label: 'Audio processing' },
  { key: 'transcription', label: 'Transcription' },
  { key: 'speakers', label: 'Speaker identification' },
  { key: 'correction', label: 'Medical correction' },
  { key: 'soap', label: 'SOAP generation' },
  { key: 'finalizing', label: 'Finalizing' },
] as const;

/**
 * Index of the active checklist step (0..n-1), or n when all complete, or -1 when idle.
 * Only advances based on real uploadStatus / processing_step — never fakes ahead.
 */
function getChecklistCurrentIndex(
  uploadStatus: UploadStatus,
  processingStep: string,
): number {
  const step = (processingStep || '').toLowerCase().trim();
  const n = CHECKLIST_STEPS.length;

  if (uploadStatus === 'idle') return -1;

  if (
    uploadStatus === 'pending_approval' ||
    uploadStatus === 'completed' ||
    step === 'pending_approval' ||
    step === 'completed'
  ) {
    return n;
  }

  if (uploadStatus === 'uploading' || step === 'uploading') return 0;

  if (uploadStatus === 'queued' || step === 'queued') return 1;

  if (step === 'started' || step === 'downloading' || step === 'cleaning') return 1;
  if (step === 'transcribing') return 2;
  if (step === 'labeling') return 3;
  if (step === 'correcting') return 4;
  if (step === 'generating' || step === 'auditing') return 5;
  // Backend writing pending_approval can briefly still report processing
  if (step === 'error') return -1;

  if (uploadStatus === 'processing') {
    // Known empty step while processing: stay on audio processing (post-queue)
    return 1;
  }

  if (uploadStatus === 'error' || uploadStatus === 'rejected') return -1;

  return 1;
}

type ChecklistVisual = 'completed' | 'current' | 'pending';

function checklistItemState(
  index: number,
  currentIndex: number,
): ChecklistVisual {
  if (currentIndex < 0) return 'pending';
  if (currentIndex >= CHECKLIST_STEPS.length) return 'completed';
  if (index < currentIndex) return 'completed';
  if (index === currentIndex) return 'current';
  return 'pending';
}

function ProcessingChecklist({
  uploadStatus,
  processingStep,
  progressMessage,
  progressPercent,
}: {
  uploadStatus: UploadStatus;
  processingStep: string;
  progressMessage: string;
  progressPercent: number;
}) {
  const currentIndex = getChecklistCurrentIndex(uploadStatus, processingStep);
  const show =
    uploadStatus === 'uploading' ||
    uploadStatus === 'queued' ||
    uploadStatus === 'processing' ||
    uploadStatus === 'pending_approval';

  if (!show) return null;

  return (
    <View
      style={{
        marginBottom: 20,
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
      }}
    >
      <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 6, color: '#0f172a' }}>
        Processing Progress
      </Text>
      {progressMessage ? (
        <Text style={{ color: '#64748b', fontSize: 13, marginBottom: 14, fontWeight: '500' }}>
          {progressMessage}
        </Text>
      ) : (
        <View style={{ height: 8 }} />
      )}

      <View
        style={{
          height: 8,
          backgroundColor: '#e2e8f0',
          borderRadius: 99,
          marginBottom: 18,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, progressPercent))}%`,
            backgroundColor: '#0d9488',
            borderRadius: 99,
          }}
        />
      </View>

      {CHECKLIST_STEPS.map((item, index) => {
        const state = checklistItemState(index, currentIndex);
        return (
          <View
            key={item.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: index === CHECKLIST_STEPS.length - 1 ? 0 : 12,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
                backgroundColor:
                  state === 'completed'
                    ? '#dcfce7'
                    : state === 'current'
                      ? '#f0fdfa'
                      : '#f8fafc',
                borderWidth: 1.5,
                borderColor:
                  state === 'completed'
                    ? '#86efac'
                    : state === 'current'
                      ? '#0d9488'
                      : '#e2e8f0',
              }}
            >
              {state === 'completed' ? (
                <MaterialCommunityIcons name="check-bold" size={16} color="#15803d" />
              ) : state === 'current' ? (
                <ActivityIndicator size="small" color="#0d9488" />
              ) : (
                <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700' }}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: state === 'pending' ? '500' : '700',
                color:
                  state === 'completed'
                    ? '#14532d'
                    : state === 'current'
                      ? '#0f172a'
                      : '#94a3b8',
              }}
            >
              {item.label}
              {state === 'completed' ? '  ✓' : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function getErrorMessage(err: unknown): string {
  if (err == null) return 'Something went wrong. Please try again.';
  if (typeof err === 'string' && err.trim()) return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
    if (typeof obj.detail === 'string' && obj.detail.trim()) return obj.detail;
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;
    if (obj.error && typeof obj.error === 'object') {
      const nested = obj.error as Record<string, unknown>;
      if (typeof nested.message === 'string' && nested.message.trim()) return nested.message;
    }
    try {
      const json = JSON.stringify(err);
      if (json && json !== '{}') return json;
    } catch {
      // fall through
    }
  }
  return String(err);
}

async function getPickedAudioBytes(picked: DocumentPicker.DocumentPickerAsset): Promise<{
  bytes: ArrayBuffer;
  name: string;
  mimeType: string;
  size?: number;
  uri: string;
}> {
  let bytes: ArrayBuffer;

  if (Platform.OS === 'web') {
    if (!picked.file) {
      throw new Error('The selected audio file could not be accessed. Please select the file again.');
    }
    bytes = await picked.file.arrayBuffer();
  } else {
    const res = await fetch(picked.uri);
    if (!res.ok) {
      throw new Error('Unable to read the selected audio file. Please select the file again.');
    }
    bytes = await res.arrayBuffer();
  }

  if (!bytes.byteLength) {
    throw new Error('The selected audio file appears to be empty. Please select another file.');
  }

  return {
    bytes,
    name: picked.name || picked.file?.name || 'consultation.mp3',
    mimeType: picked.file?.type || picked.mimeType || 'audio/mpeg',
    size: picked.size ?? picked.file?.size ?? bytes.byteLength,
    uri: picked.uri,
  };
}

function formatPreviousVisitWhen(iso: string | null | undefined): string {
  const formatted = formatAppointmentDateTime(iso);
  return formatted === '—' ? 'Date not set' : formatted;
}

function PreviousVisitPanel({
  loading,
  error,
  visit,
}: {
  loading: boolean;
  error: string | null;
  visit: PatientHistoryVisit | null;
}) {
  const sections = visit
    ? (
        [
          { key: 'assessment', label: 'Assessment', value: visit.soap_sections?.assessment },
          { key: 'plan', label: 'Plan', value: visit.soap_sections?.plan },
          { key: 'subjective', label: 'Subjective', value: visit.soap_sections?.subjective },
          { key: 'objective', label: 'Objective', value: visit.soap_sections?.objective },
        ] as const
      ).filter((s) => !!(s.value && String(s.value).trim()))
    : [];

  const rawNote =
    visit && sections.length === 0 && visit.soap_note?.trim()
      ? visit.soap_note.trim()
      : null;

  return (
    <View
      style={{
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 16,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 8 }}>
        Previous Visit
      </Text>

      {loading ? (
        <ActivityIndicator size="small" color="#0d9488" />
      ) : error ? (
        <Text style={{ color: '#b91c1c', fontSize: 13, fontWeight: '600' }}>{error}</Text>
      ) : !visit ? (
        <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }}>
          No previous completed visit
        </Text>
      ) : (
        <>
          <Text style={{ color: '#0d9488', fontSize: 13, fontWeight: '700' }}>
            {formatPreviousVisitWhen(visit.scheduled_time)}
          </Text>
          {visit.doctor_name?.trim() ? (
            <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4, fontWeight: '600' }}>
              Doctor: {visit.doctor_name.trim()}
            </Text>
          ) : null}

          {visit.clinical_summary?.trim() ? (
            <View
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 14,
                backgroundColor: '#f0fdfa',
                borderWidth: 1,
                borderColor: '#99f6e4',
              }}
            >
              <Text style={{ fontWeight: '800', color: '#0f766e', fontSize: 12, marginBottom: 4 }}>
                Previous Visit Summary
              </Text>
              <Text style={{ color: '#334155', fontSize: 13, lineHeight: 18, fontWeight: '500' }}>
                {visit.clinical_summary.trim()}
              </Text>
            </View>
          ) : null}

          {sections.length > 0 ? (
            <View style={{ marginTop: 12 }}>
              {sections.map((s) => (
                <View key={s.key} style={{ marginBottom: 10 }}>
                  <Text style={{ fontWeight: '800', color: '#0f172a', fontSize: 12, marginBottom: 2 }}>
                    {s.label}
                  </Text>
                  <Text style={{ color: '#334155', fontSize: 13, lineHeight: 18, fontWeight: '500' }}>
                    {String(s.value).trim()}
                  </Text>
                </View>
              ))}
            </View>
          ) : rawNote ? (
            <Text
              style={{
                marginTop: 12,
                color: '#334155',
                fontSize: 13,
                lineHeight: 18,
                fontWeight: '500',
              }}
            >
              {rawNote}
            </Text>
          ) : (
            <Text style={{ marginTop: 10, color: '#64748b', fontSize: 13, fontWeight: '600' }}>
              Completed visit found, but no SOAP content is available.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

export default function VoiceRecordingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    appointment_id?: string;
    patient_id?: string;
    queue_token?: string;
    patient_name?: string;
    patient_code?: string;
  }>();

  const appointmentId = params.appointment_id ? Number(params.appointment_id) : null;
  const patientId = params.patient_id ? Number(params.patient_id) : null;
  const visitToken = params.queue_token || null;
  const visitPatientName = params.patient_name || null;
  const visitPatientCode = params.patient_code || null;

  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [consultationId, setConsultationId] = useState<number | null>(null);

  const [currentStep, setCurrentStep] = useState('');
  const [progressMessage, setProgressMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyVisits, setHistoryVisits] = useState<PatientHistoryVisit[]>([]);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioBytesRef = useRef<ArrayBuffer | null>(null);
  const navigatedToReviewRef = useRef(false);

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  useEffect(() => {
    if (!patientId || Number.isNaN(patientId)) {
      setHistoryVisits([]);
      setHistoryError(null);
      setHistoryLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const hist = await getPatientHistory(patientId);
        if (!cancelled) setHistoryVisits(hist.visits || []);
      } catch (e: unknown) {
        if (!cancelled) {
          setHistoryVisits([]);
          setHistoryError(
            e instanceof Error ? e.message : 'Unable to load previous visit history.'
          );
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const previousCompletedVisit = useMemo(() => {
    return (
      historyVisits.find((v) => {
        if (appointmentId != null && v.appointment_id === appointmentId) return false;
        return (v.consultation_status || '').toLowerCase().trim() === 'completed';
      }) ?? null
    );
  }, [historyVisits, appointmentId]);

  const navigateToSoapReview = (id: number) => {
    if (navigatedToReviewRef.current) return;
    navigatedToReviewRef.current = true;
    const fromQueue =
      appointmentId != null && !Number.isNaN(appointmentId) ? '1' : '0';
    router.push({
      pathname: '/(doctor)/soap-review/[id]',
      params: {
        id: String(id),
        appointment_id:
          appointmentId != null && !Number.isNaN(appointmentId)
            ? String(appointmentId)
            : '',
        patient_id:
          patientId != null && !Number.isNaN(patientId) ? String(patientId) : '',
        queue_token: visitToken || '',
        patient_name: visitPatientName || '',
        patient_code: visitPatientCode || '',
        from_queue: fromQueue,
      },
    });
  };

  const handleUploadSelection = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;

      const picked = await getPickedAudioBytes(result.assets[0]);
      audioBytesRef.current = picked.bytes;
      setSelectedFile({
        name: picked.name,
        mimeType: picked.mimeType,
        size: picked.size,
        uri: picked.uri,
      });
      resetState(false);
    } catch (err) {
      audioBytesRef.current = null;
      const message = getErrorMessage(err);
      console.log('File pick error:', message, err);
      Alert.alert('Error', message);
    }
  };

  const startPolling = (id: number) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/consultation/${id}/status`);
        const data = await res.json();
        setUploadStatus(data.status as UploadStatus);
        setCurrentStep(data.processing_step || '');
        setProgressMessage(data.progress_message || '');
        setProgressPercent(data.progress_percent || 0);

        if (data.status === 'pending_approval') {
          setProgressPercent(100);
          if (pollingRef.current) clearInterval(pollingRef.current);
          const note = typeof data.soap_note === 'string' ? data.soap_note.trim() : '';
          if (note) {
            navigateToSoapReview(id);
          } else {
            Alert.alert(
              'SOAP Not Ready',
              'Processing finished but no SOAP note was returned. Please try again or contact support.'
            );
            setUploadStatus('error');
          }
        } else if (data.status === 'completed' || data.status === 'rejected') {
          setProgressPercent(100);
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (data.status === 'completed' && data.soap_note?.trim()) {
            navigateToSoapReview(id);
          }
        } else if (data.status === 'error') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          Alert.alert('Processing Error', data.error_message || 'Something went wrong. Please try again.');
        }
      } catch (e) {
        const message = getErrorMessage(e);
        console.log('Polling error:', message, e);
        Alert.alert('Processing Status Error', message);
      }
    }, 7000);
  };

  const getSessionDoctorId = async (): Promise<number | null> => {
    try {
      const raw = await AsyncStorage.getItem('user_data');
      if (!raw) return null;
      const user = JSON.parse(raw);
      const id = user.doctor_id;
      if (typeof id === 'number' && Number.isFinite(id)) return id;
      if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id);
      return null;
    } catch (e) {
      console.log('Could not read doctor_id from session', e);
      return null;
    }
  };

  const handleUploadAudio = async () => {
    if (!selectedFile) return;
    navigatedToReviewRef.current = false;
    setUploadStatus('uploading');
    setCurrentStep('uploading');
    setProgressMessage('Uploading audio to storage...');
    setProgressPercent(10);
    let uploadedPath: string | null = null;
    try {
      const fileExt = selectedFile.name.split('.').pop() ?? 'mp3';
      const fileName = `${Date.now()}_consultation.${fileExt}`;
      const filePath = `consultations/${fileName}`;

      const audioBytes = audioBytesRef.current;
      if (!audioBytes?.byteLength) {
        throw new Error('Picked audio is no longer available. Please select the file again.');
      }

      console.log('Upload metadata', {
        name: selectedFile.name,
        mimeType: selectedFile.mimeType,
        size: selectedFile.size,
        uri: selectedFile.uri,
        byteLength: audioBytes.byteLength,
        filePath,
      });

      const { error: storageError } = await supabase.storage
        .from('clinical-audios')
        .upload(filePath, audioBytes, {
          contentType: selectedFile.mimeType || 'audio/mpeg',
          upsert: true,
        });
      if (storageError) {
        throw new Error(`Storage upload failed: ${getErrorMessage(storageError)}`);
      }
      uploadedPath = filePath;

      const { data: { publicUrl } } = supabase.storage.from('clinical-audios').getPublicUrl(filePath);
      if (!publicUrl) {
        throw new Error('The audio was uploaded, but its storage URL could not be retrieved.');
      }
      console.log('Storage public URL', publicUrl);

      let doctorId: number | null = null;
      try {
        doctorId = await getSessionDoctorId();
      } catch (e) {
        console.log('Could not read doctor_id from session', e);
      }

      setUploadStatus('queued');
      setCurrentStep('queued');
      setProgressMessage('Queued for AI processing...');
      setProgressPercent(30);
      const backendRes = await fetch(`${API_URL}/consultation/process-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: publicUrl,
          audio_file_path: filePath,
          file_name: selectedFile.name,
          doctor_id: doctorId,
          appointment_id: appointmentId || null,
        }),
      });
      if (!backendRes.ok) {
        const errBody = await backendRes.json().catch(() => null);
        throw new Error(
          getErrorMessage(errBody) || `Unable to start audio processing (${backendRes.status}). Please try again.`
        );
      }
      const backendData = await backendRes.json();
      if (backendData.consultation_id == null) {
        throw new Error('The consultation could not be created. Please try again.');
      }
      console.log('Consultation queued', backendData.consultation_id, 'appointment_id:', backendData.appointment_id);
      setConsultationId(backendData.consultation_id);
      startPolling(backendData.consultation_id);
    } catch (err) {
      const message = getErrorMessage(err);
      console.log('Upload error:', message, err, { uploadedPath });
      setUploadStatus('error');
      Alert.alert('Upload Failed', message);
    }
  };

  const resetState = (clearFile = true) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (clearFile) {
      setSelectedFile(null);
      audioBytesRef.current = null;
    }
    setUploadStatus('idle');
    setConsultationId(null);
    setCurrentStep('');
    setProgressMessage('');
    setProgressPercent(0);
    navigatedToReviewRef.current = false;
  };

  const isActive = ['uploading', 'queued', 'processing'].includes(uploadStatus);
  const reviewReady = uploadStatus === 'pending_approval';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginBottom: 28 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: '#fff', width: 40, height: 40, borderRadius: 20,
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            borderWidth: 1, borderColor: '#e2e8f0',
          }}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color="#1e293b" />
        </TouchableOpacity>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 }}>
          Voice Recording
        </Text>
        <Text style={{ color: '#64748b', fontSize: 14, fontWeight: '500', marginTop: 4 }}>
          Capture or upload clinical consultation
        </Text>
        {appointmentId ? (
          <View
            style={{
              marginTop: 12,
              backgroundColor: '#f0fdfa',
              borderWidth: 1,
              borderColor: '#99f6e4',
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: '#0d9488', fontSize: 12, fontWeight: '700' }}>
              Visit {visitToken || `APPT-${appointmentId}`}
              {visitPatientName ? ` · ${visitPatientName}` : ''}
            </Text>
            <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
              Linked appointment_id: {appointmentId}
            </Text>
          </View>
        ) : null}
      </View>

      {patientId ? (
        <PreviousVisitPanel
          loading={historyLoading}
          error={historyError}
          visit={previousCompletedVisit}
        />
      ) : null}

      <View style={{
        backgroundColor: '#ffffff', padding: 20, borderRadius: 24,
        borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ backgroundColor: '#f0fdfa', padding: 12, borderRadius: 16, marginRight: 14, borderWidth: 1, borderColor: '#99f6e4' }}>
            <MaterialCommunityIcons name="microphone" size={26} color="#0d9488" />
          </View>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>New Consultation</Text>
            <Text style={{ color: '#64748b', fontSize: 12, marginTop: 1 }}>Upload audio to generate SOAP note</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleUploadSelection}
          disabled={isActive || reviewReady}
          style={{
            borderStyle: 'dashed', borderColor: isActive || reviewReady ? '#cbd5e1' : '#0d9488',
            borderWidth: 2, padding: 36, borderRadius: 20,
            alignItems: 'center', backgroundColor: '#f8fafc', marginBottom: 16,
            opacity: isActive || reviewReady ? 0.5 : 1,
          }}
        >
          <MaterialCommunityIcons name="cloud-upload" size={44} color={isActive || reviewReady ? '#94a3b8' : '#0d9488'} />
          <Text style={{ color: isActive || reviewReady ? '#94a3b8' : '#0d9488', fontWeight: '700', fontSize: 16, marginTop: 12 }}>
            {selectedFile ? 'File Selected' : 'Choose Audio from Device'}
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>MP3, WAV, M4A supported</Text>
        </TouchableOpacity>

        {selectedFile && (
          <View style={{ padding: 14, backgroundColor: '#f0fdfa', borderRadius: 16, borderWidth: 1, borderColor: '#99f6e4', flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="file-music" size={28} color="#0d9488" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: '#0f172a', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{selectedFile.name}</Text>
              <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>Ready to process</Text>
            </View>
            {!isActive && !reviewReady && (
              <TouchableOpacity onPress={() => {
                setSelectedFile(null);
                audioBytesRef.current = null;
              }}>
                <MaterialCommunityIcons name="close-circle" size={24} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {uploadStatus !== 'idle' && (
        <View style={{
          backgroundColor:
            uploadStatus === 'pending_approval' ? '#fefce8' :
            uploadStatus === 'completed' ? '#f0fdf4' :
            uploadStatus === 'rejected' || uploadStatus === 'error' ? '#fef2f2' : '#f0f9ff',
          borderColor:
            uploadStatus === 'pending_approval' ? '#fde68a' :
            uploadStatus === 'completed' ? '#86efac' :
            uploadStatus === 'rejected' || uploadStatus === 'error' ? '#fca5a5' : '#bae6fd',
          borderWidth: 1.5, borderRadius: 14,
          paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16, alignItems: 'center',
        }}>
          <Text style={{ color: '#334155', fontSize: 14, fontWeight: '700', textAlign: 'center' }}>
            {STATUS_MESSAGES[uploadStatus]}
          </Text>
          {consultationId != null ? (
            <Text style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>
              Consultation #{consultationId}
            </Text>
          ) : null}
        </View>
      )}

      <ProcessingChecklist
        uploadStatus={uploadStatus}
        processingStep={currentStep}
        progressMessage={progressMessage}
        progressPercent={progressPercent}
      />

      {selectedFile && uploadStatus === 'idle' && (
        <TouchableOpacity
          onPress={handleUploadAudio}
          style={{
            backgroundColor: '#0d9488', padding: 18, borderRadius: 20,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <MaterialCommunityIcons name="cloud-upload-outline" size={24} color="white" />
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 16, marginLeft: 10 }}>
            Upload & Generate SOAP Note
          </Text>
        </TouchableOpacity>
      )}

      {(uploadStatus === 'rejected' || uploadStatus === 'error') && (
        <TouchableOpacity
          onPress={() => resetState(true)}
          style={{
            backgroundColor: '#0d9488', padding: 18, borderRadius: 20,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8,
          }}
        >
          <MaterialCommunityIcons name="plus-circle-outline" size={24} color="white" />
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 16, marginLeft: 10 }}>
            New Consultation
          </Text>
        </TouchableOpacity>
      )}

      {reviewReady && consultationId != null && (
        <TouchableOpacity
          onPress={() => {
            navigatedToReviewRef.current = false;
            navigateToSoapReview(consultationId);
          }}
          style={{
            backgroundColor: '#0f172a', padding: 18, borderRadius: 20,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8,
          }}
        >
          <MaterialCommunityIcons name="clipboard-text-outline" size={24} color="white" />
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 16, marginLeft: 10 }}>
            Open SOAP Review
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

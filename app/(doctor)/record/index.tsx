import { API_URL } from '@/src/config/api';
import { supabase } from '@/src/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
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
  pending_approval: 'SOAP note is ready for doctor review',
  completed: 'SOAP note approved and finalized',
  rejected: 'SOAP note rejected',
  error: 'Processing failed. Please try again.',
};

// ─────────────────────────────────────────────────────────────
//   LABEL SYSTEM
// ─────────────────────────────────────────────────────────────
type LabelType = 'ordered' | 'inferred' | 'verify_dose' | 'verify_use' | 'consider' | 'differential' | 'none';

interface LabelStyle { bg: string; text: string; border: string; short: string; }

const LABEL_STYLES: Record<LabelType, LabelStyle> = {
  ordered:       { bg: '#dcfce7', text: '#14532d', border: '#86efac', short: 'Ordered' },
  inferred:      { bg: '#dbeafe', text: '#1e3a5f', border: '#93c5fd', short: 'Inferred' },
  verify_dose:   { bg: '#fef3c7', text: '#78350f', border: '#fcd34d', short: 'Verify Dose' },
  verify_use:    { bg: '#fee2e2', text: '#7f1d1d', border: '#fca5a5', short: 'Verify Use' },
  consider:      { bg: '#ede9fe', text: '#3b0764', border: '#c4b5fd', short: 'Consider' },
  differential:  { bg: '#f0f9ff', text: '#0c4a6e', border: '#7dd3fc', short: 'Differential Dx' },
  none:          { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', short: '' },
};

function extractLabel(text: string): LabelType {
  const m = text.match(/\[([^\]]+)\]/i);
  if (!m) return 'none';
  const raw = m[1].toLowerCase();
  if (raw.includes('doctor ordered') || raw === 'ordered') return 'ordered';
  if (raw.includes('verify before use')) return 'verify_use';
  if (raw.includes('verify dose')) return 'verify_dose';
  if (raw.includes('consider')) return 'consider';
  if (raw.includes('differential')) return 'differential';
  if (raw.includes('inferred')) return 'inferred';
  return 'none';
}

function stripLabel(text: string): string {
  return text.replace(/\[([^\]]+)\]/g, '').replace(/\*{1,2}([^*\n]*)\*{1,2}/g, '$1').trim();
}

function stripMarkdown(text: string): string {
  if (!text) return text;
  let t = text.replace(/^#{1,6}\s+/gm, '');
  t = t.replace(/\*{1,2}([^*\n]+)\*{1,2}/g, '$1');
  t = t.replace(/_{1,2}([^_\n]+)_{1,2}/g, '$1');
  t = t.replace(/\n{3,}/g, '\n\n');
  // Remove endorsement line
  t = t.replace(/✅\s*CLINICAL ENDORSEMENT[^\n]*/g, '').trim();
  return t.trim();
}

// ─────────────────────────────────────────────────────────────
//   LABEL BADGE COMPONENT
// ─────────────────────────────────────────────────────────────
function LabelBadge({ type }: { type: LabelType }) {
  if (type === 'none') return null;
  const s = LABEL_STYLES[type];
  return (
    <View style={{
      backgroundColor: s.bg, borderColor: s.border, borderWidth: 1,
      borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2,
      alignSelf: 'flex-start', marginTop: 3,
    }}>
      <Text style={{ color: s.text, fontSize: 10, fontWeight: '700', letterSpacing: 0.2 }}>
        {s.short}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//   SOAP SECTION CONFIG
// ─────────────────────────────────────────────────────────────
interface SOAPSectionConfig {
  key: string; label: string; icon: string;
  accentColor: string; bgColor: string; borderColor: string;
  badgeBg: string; badgeText: string; subtitle: string;
}
const SOAP_CONFIG: SOAPSectionConfig[] = [
  { key: 'subjective',  label: 'Subjective',  icon: 'account-voice',
    accentColor: '#0369a1', bgColor: '#f0f9ff', borderColor: '#7dd3fc',
    badgeBg: '#dbeafe', badgeText: '#1d4ed8', subtitle: 'Patient history & symptoms' },
  { key: 'objective',   label: 'Objective',   icon: 'stethoscope',
    accentColor: '#047857', bgColor: '#f0fdf4', borderColor: '#6ee7b7',
    badgeBg: '#d1fae5', badgeText: '#065f46', subtitle: 'Clinical findings & vitals' },
  { key: 'assessment',  label: 'Assessment',  icon: 'clipboard-pulse',
    accentColor: '#6d28d9', bgColor: '#faf5ff', borderColor: '#c4b5fd',
    badgeBg: '#ede9fe', badgeText: '#5b21b6', subtitle: 'Diagnosis & clinical reasoning' },
  { key: 'plan',        label: 'Plan',        icon: 'file-document-edit',
    accentColor: '#b45309', bgColor: '#fffbeb', borderColor: '#fcd34d',
    badgeBg: '#fef3c7', badgeText: '#92400e', subtitle: 'Treatment & follow-up' },
];

// ─────────────────────────────────────────────────────────────
//   STRUCTURED CONTENT PARSERS
// ─────────────────────────────────────────────────────────────

// Parse "- Key: Value" or "- **Key:** Value" bullet lines
function parseBulletLines(text: string): { key: string; value: string; label: LabelType }[] {
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('-') || l.match(/^\d+\./))
    .map(l => {
      const label = extractLabel(l);
      const clean = stripLabel(l.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, ''));
      const colonIdx = clean.indexOf(':');
      if (colonIdx > 0 && colonIdx < 40) {
        return { key: clean.slice(0, colonIdx).trim(), value: clean.slice(colonIdx + 1).trim(), label };
      }
      return { key: '', value: clean, label };
    })
    .filter(x => x.value.length > 0);
}

// Parse investigation line: "Test Name — Specimen — Priority — [Label]"
interface InvestigationItem {
  name: string; specimen: string; priority: string; label: LabelType; note: string;
}
function parseInvestigation(line: string): InvestigationItem {
  const label = extractLabel(line);  // label extract PEHLE
  const clean = line
    .replace(/^[-•]\s*/, '')
    .replace(/—\s*$/, '')
    .trim();
  
  // ✅ Em-dash AND regular dash dono support karo
  const parts = clean
    .split(/\s*[—–-]\s*/)
    .map(p => p.replace(/\[([^\]]+)\]/g, '').trim())
    .filter(Boolean);
  
  const lastPart = parts[2] || '';
  const commaIdx = lastPart.indexOf(',');
  const priority = commaIdx > -1 ? lastPart.slice(0, commaIdx).trim() : lastPart;
  const note = commaIdx > -1 ? lastPart.slice(commaIdx + 1).trim() : '';
  
  return { name: parts[0] || '', specimen: parts[1] || '', priority, label, note };
}

// Parse medication line: "Drug Dose — Route — Frequency — Duration — [Label]"
interface MedicationItem {
  name: string; route: string; frequency: string; duration: string; label: LabelType;
}
function parseMedication(line: string): MedicationItem {
  const label = extractLabel(line);  // label extract PEHLE
  const clean = line
    .replace(/^[-•]\s*/, '')
    .replace(/—\s*$/, '')
    .trim();
  
  // ✅ Em-dash AND regular dash dono support karo
  const parts = clean
    .split(/\s*[—–-]\s*/)  // em-dash, en-dash, ya hyphen
    .map(p => p.replace(/\[([^\]]+)\]/g, '').trim())  // har part se label hatao
    .filter(Boolean);
  
  return {
    name: parts[0] || '',
    route: parts[1] || '',
    frequency: parts[2] || '',
    duration: parts[3] || '',
    label,
  };
}




// ─────────────────────────────────────────────────────────────
//   SOAP NOTE PARSER (sections)
// ─────────────────────────────────────────────────────────────
function parseSOAPNote(raw: string): Record<string, string> {
  const sections: Record<string, string> = {
    subjective: '', objective: '', assessment: '', plan: ''
  };
  const headerRe = /(?:^|\n)[^\n]*?\*{0,2}(Subjective|Objective|Assessment|Plan)\*{0,2}[:\s—\-]*\n/gi;
  const matches: { name: string; end: number; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(raw)) !== null) {
    matches.push({ name: m[1].toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  for (let i = 0; i < matches.length; i++) {
    const { name, end } = matches[i];
    const contentEnd = i + 1 < matches.length ? matches[i + 1].start : raw.length;
    if (name in sections) {
      sections[name] = stripMarkdown(raw.slice(end, contentEnd));
    }
  }
  if (!Object.values(sections).some(v => v.length > 0)) {
    sections.subjective = stripMarkdown(raw);
  }
  return sections;
}

// ─────────────────────────────────────────────────────────────
//   PLAN SUBSECTION PARSER
// ─────────────────────────────────────────────────────────────
interface PlanSubsection { title: string; content: string; }
function parsePlanSubsections(planText: string): PlanSubsection[] {
  const subsRe = /(?:^|\n)\d+\.\s*([A-Za-z\/ \-]+?):\s*/gm;
  const matches: { title: string; end: number; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = subsRe.exec(planText)) !== null) {
    matches.push({ title: m[1].trim(), start: m.index, end: m.index + m[0].length });
  }
  if (matches.length === 0) return [{ title: 'Plan', content: planText }];
  return matches.map((match, i) => ({
    title: match.title,
    content: planText.slice(match.end, i + 1 < matches.length ? matches[i + 1].start : planText.length)
      .replace(/^\*+\s*/, '').trim(),
  }));
}

// ─────────────────────────────────────────────────────────────
//   PRIORITY BADGE (for investigations)
// ─────────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const p = priority.toUpperCase();
  const colors =
    p === 'STAT'    ? { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' } :
    p === 'URGENT'  ? { bg: '#fef3c7', text: '#78350f', border: '#fcd34d' } :
                      { bg: '#f0fdf4', text: '#14532d', border: '#86efac' };
  if (!p) return null;
  return (
    <View style={{
      backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1,
      borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1,
    }}>
      <Text style={{ color: colors.text, fontSize: 10, fontWeight: '800' }}>{p}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//   INVESTIGATION TABLE ROW
// ─────────────────────────────────────────────────────────────
function InvestigationRow({ item, isLast }: { item: InvestigationItem; isLast: boolean }) {
  const ls = LABEL_STYLES[item.label];
  return (
    <View style={{
      borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: '#e2e8f0',
      paddingVertical: 10, paddingHorizontal: 12,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '700', lineHeight: 18 }}>
            {item.name}
          </Text>
          {item.specimen ? (
            <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
              {item.specimen}
              {item.note ? <Text style={{ color: '#94a3b8' }}>  •  {item.note}</Text> : null}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {item.priority ? <PriorityBadge priority={item.priority} /> : null}
          <LabelBadge type={item.label} />
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//   MEDICATION CARD ROW
// ─────────────────────────────────────────────────────────────
function MedicationRow({ item, isLast }: { item: MedicationItem; isLast: boolean }) {
  return (
    <View style={{
      borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: '#e2e8f0',
      paddingVertical: 10, paddingHorizontal: 12,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '700', lineHeight: 18 }}>
            {item.name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {item.route ? (
              <View style={{ backgroundColor: '#f8fafc', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 0.5, borderColor: '#e2e8f0' }}>
                <Text style={{ color: '#475569', fontSize: 11 }}>{item.route}</Text>
              </View>
            ) : null}
            {item.frequency ? (
              <View style={{ backgroundColor: '#f0f9ff', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 0.5, borderColor: '#bae6fd' }}>
                <Text style={{ color: '#0369a1', fontSize: 11, fontWeight: '600' }}>{item.frequency}</Text>
              </View>
            ) : null}
            {item.duration ? (
              <View style={{ backgroundColor: '#fafafa', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 0.5, borderColor: '#e2e8f0' }}>
                <Text style={{ color: '#64748b', fontSize: 11 }}>{item.duration}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <LabelBadge type={item.label} />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//   STRUCTURED SUBJECTIVE RENDERER
// ─────────────────────────────────────────────────────────────
function SubjectiveRenderer({ text }: { text: string }) {
  const items = parseBulletLines(text);
  if (items.length === 0) return <PlainText text={text} />;
  return (
    <View style={{ gap: 10 }}>
      {items.map((item, i) => (
        <View key={i}>
          {item.key ? (
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.5, marginBottom: 2, textTransform: 'uppercase' }}>
              {item.key}
            </Text>
          ) : null}
          <Text style={{ color: '#1e293b', fontSize: 13, lineHeight: 20 }}>
            {item.value}
          </Text>
          <LabelBadge type={item.label} />
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//   STRUCTURED OBJECTIVE RENDERER
// ─────────────────────────────────────────────────────────────
function ObjectiveRenderer({ text }: { text: string }) {
  const items = parseBulletLines(text);
  if (items.length === 0) return <PlainText text={text} />;
  return (
    <View style={{ gap: 10 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{
            width: 6, height: 6, borderRadius: 3, backgroundColor: '#047857',
            marginTop: 7, marginRight: 10, flexShrink: 0,
          }} />
          <View style={{ flex: 1 }}>
            {item.key ? (
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#047857', marginBottom: 1, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {item.key}
              </Text>
            ) : null}
            <Text style={{ color: '#1e293b', fontSize: 13, lineHeight: 20 }}>{item.value}</Text>
            <LabelBadge type={item.label} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//   STRUCTURED ASSESSMENT RENDERER
// ─────────────────────────────────────────────────────────────
function AssessmentRenderer({ text }: { text: string }) {
  const items = parseBulletLines(text);
  if (items.length === 0) return <PlainText text={text} />;
  return (
    <View style={{ gap: 12 }}>
      {items.map((item, i) => {
        const isDifferential = item.label === 'differential';
        return (
          <View key={i} style={{
            backgroundColor: isDifferential ? '#f0f9ff' : 'transparent',
            borderLeftWidth: isDifferential ? 3 : 0,
            borderLeftColor: '#7dd3fc',
            paddingLeft: isDifferential ? 10 : 0,
            borderRadius: isDifferential ? 4 : 0,
            paddingVertical: isDifferential ? 4 : 0,
          }}>
            {item.key ? (
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#6d28d9', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {item.key}
              </Text>
            ) : null}
            <Text style={{ color: '#1e293b', fontSize: 13, lineHeight: 20, fontWeight: isDifferential ? '500' : '400' }}>
              {item.value}
            </Text>
            <LabelBadge type={item.label} />
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//   STRUCTURED PLAN RENDERER
// ─────────────────────────────────────────────────────────────
function PlanRenderer({ text }: { text: string }) {
  const subsections = parsePlanSubsections(text);

  return (
    <View style={{ gap: 16 }}>
      {subsections.map((sub, si) => {
        const titleLower = sub.title.toLowerCase();
        const isInvestigations = titleLower.includes('invest');
        const isMedications = titleLower.includes('med') || titleLower.includes('pharma');
        const lines = sub.content.split('\n').map(l => l.trim()).filter(l => l.startsWith('-') || l.startsWith('•'));

        return (
          <View key={si}>
            {/* Subsection header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              marginBottom: 8, gap: 6,
            }}>
              <MaterialCommunityIcons
                name={
                  isInvestigations ? 'test-tube' :
                  isMedications ? 'pill' :
                  titleLower.includes('follow') ? 'calendar-clock' :
                  titleLower.includes('edu') ? 'school' :
                  'leaf'
                }
                size={14}
                color="#b45309"
              />
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {sub.title}
              </Text>
            </View>

            {/* Investigations: table-style cards */}
            {isInvestigations && lines.length > 0 ? (
              <View style={{
                backgroundColor: '#ffffff', borderRadius: 12,
                borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden',
              }}>
                {lines.map((line, li) => (
                  <InvestigationRow
                    key={li}
                    item={parseInvestigation(line)}
                    isLast={li === lines.length - 1}
                  />
                ))}
              </View>
            ) : isMedications && lines.length > 0 ? (
              /* Medications: colored cards */
              <View style={{
                backgroundColor: '#ffffff', borderRadius: 12,
                borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden',
              }}>
                {lines.map((line, li) => (
                  <MedicationRow
                    key={li}
                    item={parseMedication(line)}
                    isLast={li === lines.length - 1}
                  />
                ))}
              </View>
            ) : (
              /* Other subsections: bullet list */
              <View style={{ gap: 6 }}>
                {lines.length > 0 ? lines.map((line, li) => {
                  const label = extractLabel(line);
                  const clean = stripLabel(line.replace(/^[-•]\s*/, ''));
                  return (
                    <View key={li} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={{
                        width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#b45309',
                        marginTop: 7, marginRight: 8, flexShrink: 0,
                      }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#1e293b', fontSize: 13, lineHeight: 20 }}>{clean}</Text>
                        <LabelBadge type={label} />
                      </View>
                    </View>
                  );
                }) : (
                  /* Non-bullet content (e.g., Follow-up paragraph) */
                  <View>
                    {sub.content.split('\n').filter(l => l.trim()).map((line, li) => {
                      const label = extractLabel(line);
                      const clean = stripLabel(line.replace(/^[-•\d.]\s*/, ''));
                      return (
                        <View key={li} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                          <View style={{
                            width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#b45309',
                            marginTop: 7, marginRight: 8, flexShrink: 0,
                          }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#1e293b', fontSize: 13, lineHeight: 20 }}>{clean}</Text>
                            <LabelBadge type={label} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//   PLAIN TEXT FALLBACK
// ─────────────────────────────────────────────────────────────
function PlainText({ text }: { text: string }) {
  return (
    <View style={{ gap: 6 }}>
      {text.split('\n').filter(l => l.trim()).map((line, i) => {
        const label = extractLabel(line);
        const clean = stripLabel(line.replace(/^[-•*]\s*/, ''));
        if (!clean) return null;
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{
              width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#94a3b8',
              marginTop: 7, marginRight: 8, flexShrink: 0,
            }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#1e293b', fontSize: 13, lineHeight: 20 }}>{clean}</Text>
              <LabelBadge type={label} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//   SOAP SECTION CARD
// ─────────────────────────────────────────────────────────────
function SOAPSectionCard({
  config, content, editMode, onEdit,
}: {
  config: SOAPSectionConfig; content: string;
  editMode: boolean; onEdit: (text: string) => void;
}) {
  if (!content && !editMode) return null;

  const renderContent = () => {
    if (editMode) {
      return (
        <TextInput
          value={content}
          onChangeText={onEdit}
          multiline
          placeholder={`Enter ${config.label} details...`}
          placeholderTextColor="#94a3b8"
          style={{
            color: '#0f172a', fontSize: 13, lineHeight: 20,
            minHeight: 100, textAlignVertical: 'top',
            borderWidth: 1, borderColor: config.borderColor,
            borderRadius: 10, padding: 10, backgroundColor: '#ffffff',
          }}
        />
      );
    }
    if (!content) return (
      <Text style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
        No content for this section
      </Text>
    );
    if (config.key === 'subjective') return <SubjectiveRenderer text={content} />;
    if (config.key === 'objective')  return <ObjectiveRenderer  text={content} />;
    if (config.key === 'assessment') return <AssessmentRenderer text={content} />;
    if (config.key === 'plan')       return <PlanRenderer       text={content} />;
    return <PlainText text={content} />;
  };

  return (
    <View style={{
      backgroundColor: config.bgColor, borderColor: config.borderColor,
      borderWidth: 1.5, borderRadius: 18, marginBottom: 14, overflow: 'hidden',
    }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomColor: config.borderColor, borderBottomWidth: 1.5,
      }}>
        <View style={{
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: config.badgeBg, alignItems: 'center',
          justifyContent: 'center', marginRight: 10,
        }}>
          <MaterialCommunityIcons name={config.icon as any} size={20} color={config.accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{
            color: config.accentColor, fontWeight: '800', fontSize: 15,
            letterSpacing: 0.6, textTransform: 'uppercase',
          }}>
            {config.label}
          </Text>
          <Text style={{ color: config.accentColor, fontSize: 11, opacity: 0.7, marginTop: 1 }}>
            {config.subtitle}
          </Text>
        </View>
        {editMode && (
          <View style={{
            backgroundColor: config.badgeBg, borderColor: config.borderColor,
            borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
          }}>
            <Text style={{ color: config.accentColor, fontSize: 11, fontWeight: '700' }}>Editing</Text>
          </View>
        )}
      </View>
      {/* Content */}
      <View style={{ padding: 16 }}>
        {renderContent()}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//   LABEL LEGEND
// ─────────────────────────────────────────────────────────────
function LabelLegend() {
  const labels: { type: LabelType; desc: string }[] = [
    { type: 'ordered',      desc: 'Doctor explicitly ordered' },
    { type: 'inferred',     desc: 'AI clinical logic' },
    { type: 'verify_dose',  desc: 'Dose needs confirmation' },
    { type: 'verify_use',   desc: 'Medication not mentioned — AI suggestion' },
    { type: 'consider',     desc: 'Test not ordered — AI suggestion' },
    { type: 'differential', desc: 'Possible alternate diagnosis' },
  ];
  return (
    <View style={{
      marginBottom: 16, padding: 12,
      backgroundColor: '#f8fafc', borderRadius: 12,
      borderWidth: 1, borderColor: '#e2e8f0',
    }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748b', marginBottom: 8, letterSpacing: 0.5 }}>
        LABEL GUIDE
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {labels.map(({ type, desc }) => {
          const s = LABEL_STYLES[type];
          return (
            <View key={type} style={{ flexDirection: 'row', alignItems: 'center', width: '47%' }}>
              <View style={{
                backgroundColor: s.bg, borderColor: s.border, borderWidth: 1,
                borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginRight: 5,
              }}>
                <Text style={{ color: s.text, fontSize: 9, fontWeight: '700' }}>{s.short}</Text>
              </View>
              <Text style={{ color: '#94a3b8', fontSize: 10, flex: 1 }} numberOfLines={1}>{desc}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//   ERROR MESSAGE HELPER
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
//   MAIN SCREEN
// ─────────────────────────────────────────────────────────────
export default function VoiceRecordingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    appointment_id?: string;
    queue_token?: string;
    patient_name?: string;
    patient_code?: string;
  }>();

  // Visit context from doctor queue (linked to consultation in a later step)
  const appointmentId = params.appointment_id ? Number(params.appointment_id) : null;
  const visitToken = params.queue_token || null;
  const visitPatientName = params.patient_name || null;

  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [soapRaw, setSoapRaw] = useState('');
  const [soapSections, setSoapSections] = useState<Record<string, string>>({});
  const [consultationId, setConsultationId] = useState<number | null>(null);

  const [currentStep, setCurrentStep] = useState('');
  const [progressMessage, setProgressMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const [editMode, setEditMode] = useState(false);
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioBytesRef = useRef<ArrayBuffer | null>(null);

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  useEffect(() => {
    if (soapRaw) {
      const parsed = parseSOAPNote(soapRaw);
      setSoapSections(parsed);
      setEditedSections(parsed);
    }
  }, [soapRaw]);

  const buildRawFromEdited = () =>
    SOAP_CONFIG
      .filter(c => editedSections[c.key]?.trim())
      .map(c => `**${c.label}:**\n${editedSections[c.key].trim()}`)
      .join('\n\n');

  // ── File pick ─────────────────────────────────────────────
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

  // ── Polling ───────────────────────────────────────────────
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
        if (['pending_approval', 'completed', 'rejected'].includes(data.status)) {
          if (data.soap_note) setSoapRaw(data.soap_note);
          setProgressPercent(100);
          if (pollingRef.current) clearInterval(pollingRef.current);
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

  // ── Upload ────────────────────────────────────────────────
  const handleUploadAudio = async () => {
    if (!selectedFile) return;
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
          // Link this consultation to the visit when started from doctor queue
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

  // ── Approve ───────────────────────────────────────────────
  const handleApprove = async () => {
    if (!consultationId) return;
    setIsApproving(true);
    try {
      const finalSoap = editMode ? buildRawFromEdited() : soapRaw;
      const doctorId = await getSessionDoctorId();
      const res = await fetch(`${API_URL}/consultation/${consultationId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_soap: finalSoap, doctor_id: doctorId }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(getErrorMessage(errBody) || `Unable to approve the SOAP note (${res.status}). Please try again.`);
      }
      setUploadStatus('completed');
      setSoapRaw(finalSoap);
      setEditMode(false);
      Alert.alert('Approved!', 'SOAP note saved successfully.');
    } catch (e) {
      const message = getErrorMessage(e);
      console.log('Approve error:', message, e);
      Alert.alert('Error', message);
    } finally { setIsApproving(false); }
  };

  // ── Reject ────────────────────────────────────────────────
  const handleReject = async () => {
    if (!consultationId) return;
    Alert.alert('Reject SOAP Note?', 'Are you sure you want to reject this SOAP note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        setIsRejecting(true);
        try {
          const res = await fetch(`${API_URL}/consultation/${consultationId}/reject?reason=Doctor%20rejected%20from%20app`, { method: 'POST' });
          if (!res.ok) {
            const errBody = await res.json().catch(() => null);
            throw new Error(getErrorMessage(errBody) || `Unable to reject the SOAP note (${res.status}). Please try again.`);
          }
          setUploadStatus('rejected');
          setEditMode(false);
        } catch (e) {
          const message = getErrorMessage(e);
          console.log('Reject error:', message, e);
          Alert.alert('Error', message);
        }
        finally { setIsRejecting(false); }
      }},
    ]);
  };

  // ── Reset ─────────────────────────────────────────────────
  const resetState = (clearFile = true) => {
    if (clearFile) {
      setSelectedFile(null);
      audioBytesRef.current = null;
    }
    setUploadStatus('idle');
    setSoapRaw('');
    setSoapSections({});
    setEditedSections({});
    setConsultationId(null);
    setCurrentStep('');
    setProgressMessage('');
    setProgressPercent(0);
    setEditMode(false);
  };

  const isActive = ['uploading', 'queued', 'processing'].includes(uploadStatus);
  const showReview = uploadStatus === 'pending_approval';
  const showFinalNote = uploadStatus === 'completed' || uploadStatus === 'rejected';
  const displaySections = editMode ? editedSections : soapSections;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 60 : 40, paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
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

      {/* ── Upload Card ── */}
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
          disabled={isActive || showReview}
          style={{
            borderStyle: 'dashed', borderColor: isActive || showReview ? '#cbd5e1' : '#0d9488',
            borderWidth: 2, padding: 36, borderRadius: 20,
            alignItems: 'center', backgroundColor: '#f8fafc', marginBottom: 16,
            opacity: isActive || showReview ? 0.5 : 1,
          }}
        >
          <MaterialCommunityIcons name="cloud-upload" size={44} color={isActive || showReview ? '#94a3b8' : '#0d9488'} />
          <Text style={{ color: isActive || showReview ? '#94a3b8' : '#0d9488', fontWeight: '700', fontSize: 16, marginTop: 12 }}>
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
            {!isActive && !showReview && (
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

      {/* ── Status Banner ── */}
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
        </View>
      )}

      {/* ── Progress ── */}
      {(uploadStatus === 'queued' || uploadStatus === 'processing') && (
        <View style={{ marginBottom: 20, padding: 20, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' }}>
          <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 14, color: '#0f172a' }}>Processing Progress</Text>
          <View style={{ height: 10, backgroundColor: '#e2e8f0', borderRadius: 99, marginBottom: 12, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: '#0d9488', borderRadius: 99 }} />
          </View>
          <Text style={{ color: '#334155', fontWeight: '600', fontSize: 14 }}>{progressMessage}</Text>
          {currentStep ? <Text style={{ color: '#0d9488', fontSize: 12, marginTop: 4, fontWeight: '600' }}>Step: {currentStep}</Text> : null}
        </View>
      )}

      {/* ── SOAP Review ── */}
      {(showReview || showFinalNote) && Object.values(displaySections).some(v => v) && (
        <View style={{ marginBottom: 24 }}>
          {/* Review header */}
          {showReview && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a' }}>SOAP Note Review</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>AI-generated — Doctor approval required</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditMode(!editMode)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: editMode ? '#0f172a' : '#f1f5f9',
                  paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
                  borderWidth: 1, borderColor: editMode ? '#0f172a' : '#cbd5e1',
                }}
              >
                <MaterialCommunityIcons name={editMode ? 'check-bold' : 'pencil-outline'} size={16} color={editMode ? 'white' : '#475569'} />
                <Text style={{ color: editMode ? 'white' : '#475569', fontWeight: '700', fontSize: 13, marginLeft: 6 }}>
                  {editMode ? 'Done' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Final note header */}
          {showFinalNote && (
            <Text style={{ fontSize: 18, fontWeight: '800', color: uploadStatus === 'completed' ? '#14532d' : '#991b1b', marginBottom: 12 }}>
              {uploadStatus === 'completed' ? 'Approved SOAP Note' : 'Rejected SOAP Note'}
            </Text>
          )}

          {/* Full progress bar */}
          <View style={{ height: 5, backgroundColor: '#e2e8f0', borderRadius: 99, marginBottom: 16, overflow: 'hidden' }}>
            <View style={{ width: '100%', height: '100%', backgroundColor: '#0d9488', borderRadius: 99 }} />
          </View>

          {/* Label legend (review only) */}
          {showReview && <LabelLegend />}

          {/* SOAP sections */}
          {SOAP_CONFIG.map(config => (
            <SOAPSectionCard
              key={config.key}
              config={config}
              content={displaySections[config.key] || ''}
              editMode={editMode}
              onEdit={text => setEditedSections(prev => ({ ...prev, [config.key]: text }))}
            />
          ))}

          {/* Approve / Reject buttons */}
          {showReview && (
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                onPress={handleReject}
                disabled={isRejecting || isApproving}
                style={{
                  flex: 1, backgroundColor: '#fff1f2', borderWidth: 1.5, borderColor: '#fca5a5',
                  borderRadius: 16, paddingVertical: 15, flexDirection: 'row',
                  alignItems: 'center', justifyContent: 'center', opacity: isRejecting ? 0.6 : 1,
                }}
              >
                <MaterialCommunityIcons name="close-circle-outline" size={20} color="#dc2626" />
                <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 15, marginLeft: 8 }}>
                  {isRejecting ? 'Rejecting...' : 'Reject'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleApprove}
                disabled={isApproving || isRejecting}
                style={{
                  flex: 2, backgroundColor: '#0d9488', borderRadius: 16, paddingVertical: 15,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  opacity: isApproving ? 0.6 : 1,
                }}
              >
                <MaterialCommunityIcons name="check-circle-outline" size={20} color="white" />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 15, marginLeft: 8 }}>
                  {isApproving ? 'Approving...' : 'Approve & Save'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Upload Button ── */}
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

      {/* ── New Consultation ── */}
      {(uploadStatus === 'completed' || uploadStatus === 'rejected' || uploadStatus === 'error') && (
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
    </ScrollView>
  );
}
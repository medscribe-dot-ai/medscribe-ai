import { API_URL } from '@/src/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ─────────────────────────────────────────────────────────────
//   LABEL SYSTEM (same behavior as previous Record SOAP UI)
// ─────────────────────────────────────────────────────────────
type LabelType =
  | 'ordered'
  | 'inferred'
  | 'verify_dose'
  | 'verify_use'
  | 'consider'
  | 'differential'
  | 'none';

interface LabelStyle {
  bg: string;
  text: string;
  border: string;
  short: string;
}

const LABEL_STYLES: Record<LabelType, LabelStyle> = {
  ordered: { bg: '#dcfce7', text: '#14532d', border: '#86efac', short: 'Ordered' },
  inferred: { bg: '#dbeafe', text: '#1e3a5f', border: '#93c5fd', short: 'Inferred' },
  verify_dose: { bg: '#fef3c7', text: '#78350f', border: '#fcd34d', short: 'Verify Dose' },
  verify_use: { bg: '#fee2e2', text: '#7f1d1d', border: '#fca5a5', short: 'Verify Use' },
  consider: { bg: '#ede9fe', text: '#3b0764', border: '#c4b5fd', short: 'Consider' },
  differential: { bg: '#f0f9ff', text: '#0c4a6e', border: '#7dd3fc', short: 'Differential Dx' },
  none: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', short: '' },
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
  return text
    .replace(/\[([^\]]+)\]/g, '')
    .replace(/\*{1,2}([^*\n]*)\*{1,2}/g, '$1')
    .trim();
}

function stripMarkdown(text: string): string {
  if (!text) return text;
  let t = text.replace(/^#{1,6}\s+/gm, '');
  t = t.replace(/\*{1,2}([^*\n]+)\*{1,2}/g, '$1');
  t = t.replace(/_{1,2}([^_\n]+)_{1,2}/g, '$1');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/✅\s*CLINICAL ENDORSEMENT[^\n]*/g, '').trim();
  return t.trim();
}

function LabelBadge({ type }: { type: LabelType }) {
  if (type === 'none') return null;
  const s = LABEL_STYLES[type];
  return (
    <View
      style={{
        backgroundColor: s.bg,
        borderColor: s.border,
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 7,
        paddingVertical: 2,
        alignSelf: 'flex-start',
        marginTop: 3,
      }}
    >
      <Text style={{ color: s.text, fontSize: 10, fontWeight: '700', letterSpacing: 0.2 }}>
        {s.short}
      </Text>
    </View>
  );
}

interface SOAPSectionConfig {
  key: string;
  label: string;
  icon: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  subtitle: string;
}

const SOAP_CONFIG: SOAPSectionConfig[] = [
  {
    key: 'subjective',
    label: 'Subjective',
    icon: 'account-voice',
    accentColor: '#0369a1',
    bgColor: '#f0f9ff',
    borderColor: '#7dd3fc',
    badgeBg: '#dbeafe',
    badgeText: '#1d4ed8',
    subtitle: 'Patient history & symptoms',
  },
  {
    key: 'objective',
    label: 'Objective',
    icon: 'stethoscope',
    accentColor: '#047857',
    bgColor: '#f0fdf4',
    borderColor: '#6ee7b7',
    badgeBg: '#d1fae5',
    badgeText: '#065f46',
    subtitle: 'Clinical findings & vitals',
  },
  {
    key: 'assessment',
    label: 'Assessment',
    icon: 'clipboard-pulse',
    accentColor: '#6d28d9',
    bgColor: '#faf5ff',
    borderColor: '#c4b5fd',
    badgeBg: '#ede9fe',
    badgeText: '#5b21b6',
    subtitle: 'Diagnosis & clinical reasoning',
  },
  {
    key: 'plan',
    label: 'Plan',
    icon: 'file-document-edit',
    accentColor: '#b45309',
    bgColor: '#fffbeb',
    borderColor: '#fcd34d',
    badgeBg: '#fef3c7',
    badgeText: '#92400e',
    subtitle: 'Treatment & follow-up',
  },
];

function parseBulletLines(text: string): { key: string; value: string; label: LabelType }[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-') || l.match(/^\d+\./))
    .map((l) => {
      const label = extractLabel(l);
      const clean = stripLabel(l.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, ''));
      const colonIdx = clean.indexOf(':');
      if (colonIdx > 0 && colonIdx < 40) {
        return {
          key: clean.slice(0, colonIdx).trim(),
          value: clean.slice(colonIdx + 1).trim(),
          label,
        };
      }
      return { key: '', value: clean, label };
    })
    .filter((x) => x.value.length > 0);
}

interface InvestigationItem {
  name: string;
  specimen: string;
  priority: string;
  label: LabelType;
  note: string;
}

function parseInvestigation(line: string): InvestigationItem {
  const label = extractLabel(line);
  const clean = line
    .replace(/^[-•]\s*/, '')
    .replace(/—\s*$/, '')
    .trim();
  const parts = clean
    .split(/\s*[—–-]\s*/)
    .map((p) => p.replace(/\[([^\]]+)\]/g, '').trim())
    .filter(Boolean);
  const lastPart = parts[2] || '';
  const commaIdx = lastPart.indexOf(',');
  const priority = commaIdx > -1 ? lastPart.slice(0, commaIdx).trim() : lastPart;
  const note = commaIdx > -1 ? lastPart.slice(commaIdx + 1).trim() : '';
  return { name: parts[0] || '', specimen: parts[1] || '', priority, label, note };
}

interface MedicationItem {
  name: string;
  route: string;
  frequency: string;
  duration: string;
  label: LabelType;
}

function parseMedication(line: string): MedicationItem {
  const label = extractLabel(line);
  const clean = line
    .replace(/^[-•]\s*/, '')
    .replace(/—\s*$/, '')
    .trim();
  const parts = clean
    .split(/\s*[—–-]\s*/)
    .map((p) => p.replace(/\[([^\]]+)\]/g, '').trim())
    .filter(Boolean);
  return {
    name: parts[0] || '',
    route: parts[1] || '',
    frequency: parts[2] || '',
    duration: parts[3] || '',
    label,
  };
}

function parseSOAPNote(raw: string): Record<string, string> {
  const sections: Record<string, string> = {
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  };
  const headerRe =
    /(?:^|\n)[^\n]*?\*{0,2}(Subjective|Objective|Assessment|Plan)\*{0,2}[:\s—\-]*\n/gi;
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
  if (!Object.values(sections).some((v) => v.length > 0)) {
    sections.subjective = stripMarkdown(raw);
  }
  return sections;
}

interface PlanSubsection {
  title: string;
  content: string;
}

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
    content: planText
      .slice(match.end, i + 1 < matches.length ? matches[i + 1].start : planText.length)
      .replace(/^\*+\s*/, '')
      .trim(),
  }));
}

function PriorityBadge({ priority }: { priority: string }) {
  const p = priority.toUpperCase();
  const colors =
    p === 'STAT'
      ? { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' }
      : p === 'URGENT'
        ? { bg: '#fef3c7', text: '#78350f', border: '#fcd34d' }
        : { bg: '#f0fdf4', text: '#14532d', border: '#86efac' };
  if (!p) return null;
  return (
    <View
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 6,
        paddingVertical: 1,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 10, fontWeight: '800' }}>{p}</Text>
    </View>
  );
}

function InvestigationRow({ item, isLast }: { item: InvestigationItem; isLast: boolean }) {
  return (
    <View
      style={{
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
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

function MedicationRow({ item, isLast }: { item: MedicationItem; isLast: boolean }) {
  return (
    <View
      style={{
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '700', lineHeight: 18 }}>
            {item.name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {item.route ? (
              <View
                style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: 4,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderWidth: 0.5,
                  borderColor: '#e2e8f0',
                }}
              >
                <Text style={{ color: '#475569', fontSize: 11 }}>{item.route}</Text>
              </View>
            ) : null}
            {item.frequency ? (
              <View
                style={{
                  backgroundColor: '#f0f9ff',
                  borderRadius: 4,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderWidth: 0.5,
                  borderColor: '#bae6fd',
                }}
              >
                <Text style={{ color: '#0369a1', fontSize: 11, fontWeight: '600' }}>
                  {item.frequency}
                </Text>
              </View>
            ) : null}
            {item.duration ? (
              <View
                style={{
                  backgroundColor: '#fafafa',
                  borderRadius: 4,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderWidth: 0.5,
                  borderColor: '#e2e8f0',
                }}
              >
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

function PlainText({ text }: { text: string }) {
  return (
    <View style={{ gap: 6 }}>
      {text
        .split('\n')
        .filter((l) => l.trim())
        .map((line, i) => {
          const label = extractLabel(line);
          const clean = stripLabel(line.replace(/^[-•*]\s*/, ''));
          if (!clean) return null;
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: '#94a3b8',
                  marginTop: 7,
                  marginRight: 8,
                  flexShrink: 0,
                }}
              />
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

function SubjectiveRenderer({ text }: { text: string }) {
  const items = parseBulletLines(text);
  if (items.length === 0) return <PlainText text={text} />;
  return (
    <View style={{ gap: 10 }}>
      {items.map((item, i) => (
        <View key={i}>
          {item.key ? (
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: '#64748b',
                letterSpacing: 0.5,
                marginBottom: 2,
                textTransform: 'uppercase',
              }}
            >
              {item.key}
            </Text>
          ) : null}
          <Text style={{ color: '#1e293b', fontSize: 13, lineHeight: 20 }}>{item.value}</Text>
          <LabelBadge type={item.label} />
        </View>
      ))}
    </View>
  );
}

function ObjectiveRenderer({ text }: { text: string }) {
  const items = parseBulletLines(text);
  if (items.length === 0) return <PlainText text={text} />;
  return (
    <View style={{ gap: 10 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#047857',
              marginTop: 7,
              marginRight: 10,
              flexShrink: 0,
            }}
          />
          <View style={{ flex: 1 }}>
            {item.key ? (
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#047857',
                  marginBottom: 1,
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                }}
              >
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

function AssessmentRenderer({ text }: { text: string }) {
  const items = parseBulletLines(text);
  if (items.length === 0) return <PlainText text={text} />;
  return (
    <View style={{ gap: 12 }}>
      {items.map((item, i) => {
        const isDifferential = item.label === 'differential';
        return (
          <View
            key={i}
            style={{
              backgroundColor: isDifferential ? '#f0f9ff' : 'transparent',
              borderLeftWidth: isDifferential ? 3 : 0,
              borderLeftColor: '#7dd3fc',
              paddingLeft: isDifferential ? 10 : 0,
              borderRadius: isDifferential ? 4 : 0,
              paddingVertical: isDifferential ? 4 : 0,
            }}
          >
            {item.key ? (
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#6d28d9',
                  marginBottom: 2,
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                }}
              >
                {item.key}
              </Text>
            ) : null}
            <Text
              style={{
                color: '#1e293b',
                fontSize: 13,
                lineHeight: 20,
                fontWeight: isDifferential ? '500' : '400',
              }}
            >
              {item.value}
            </Text>
            <LabelBadge type={item.label} />
          </View>
        );
      })}
    </View>
  );
}

function PlanRenderer({ text }: { text: string }) {
  const subsections = parsePlanSubsections(text);
  return (
    <View style={{ gap: 16 }}>
      {subsections.map((sub, si) => {
        const titleLower = sub.title.toLowerCase();
        const isInvestigations = titleLower.includes('invest');
        const isMedications = titleLower.includes('med') || titleLower.includes('pharma');
        const lines = sub.content
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.startsWith('-') || l.startsWith('•'));

        return (
          <View key={si}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
              <MaterialCommunityIcons
                name={
                  isInvestigations
                    ? 'test-tube'
                    : isMedications
                      ? 'pill'
                      : titleLower.includes('follow')
                        ? 'calendar-clock'
                        : titleLower.includes('edu')
                          ? 'school'
                          : 'leaf'
                }
                size={14}
                color="#b45309"
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: '#b45309',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {sub.title}
              </Text>
            </View>

            {isInvestigations && lines.length > 0 ? (
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  overflow: 'hidden',
                }}
              >
                {lines.map((line, li) => (
                  <InvestigationRow
                    key={li}
                    item={parseInvestigation(line)}
                    isLast={li === lines.length - 1}
                  />
                ))}
              </View>
            ) : isMedications && lines.length > 0 ? (
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  overflow: 'hidden',
                }}
              >
                {lines.map((line, li) => (
                  <MedicationRow
                    key={li}
                    item={parseMedication(line)}
                    isLast={li === lines.length - 1}
                  />
                ))}
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                {lines.length > 0 ? (
                  lines.map((line, li) => {
                    const label = extractLabel(line);
                    const clean = stripLabel(line.replace(/^[-•]\s*/, ''));
                    return (
                      <View key={li} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 2.5,
                            backgroundColor: '#b45309',
                            marginTop: 7,
                            marginRight: 8,
                            flexShrink: 0,
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#1e293b', fontSize: 13, lineHeight: 20 }}>
                            {clean}
                          </Text>
                          <LabelBadge type={label} />
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View>
                    {sub.content
                      .split('\n')
                      .filter((l) => l.trim())
                      .map((line, li) => {
                        const label = extractLabel(line);
                        const clean = stripLabel(line.replace(/^[-•\d.]\s*/, ''));
                        return (
                          <View
                            key={li}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'flex-start',
                              marginBottom: 4,
                            }}
                          >
                            <View
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: 2.5,
                                backgroundColor: '#b45309',
                                marginTop: 7,
                                marginRight: 8,
                                flexShrink: 0,
                              }}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#1e293b', fontSize: 13, lineHeight: 20 }}>
                                {clean}
                              </Text>
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

function SOAPSectionCard({
  config,
  content,
  editMode,
  onEdit,
}: {
  config: SOAPSectionConfig;
  content: string;
  editMode: boolean;
  onEdit: (text: string) => void;
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
            color: '#0f172a',
            fontSize: 13,
            lineHeight: 20,
            minHeight: 100,
            textAlignVertical: 'top',
            borderWidth: 1,
            borderColor: config.borderColor,
            borderRadius: 10,
            padding: 10,
            backgroundColor: '#ffffff',
          }}
        />
      );
    }
    if (!content) {
      return (
        <Text style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
          No content for this section
        </Text>
      );
    }
    if (config.key === 'subjective') return <SubjectiveRenderer text={content} />;
    if (config.key === 'objective') return <ObjectiveRenderer text={content} />;
    if (config.key === 'assessment') return <AssessmentRenderer text={content} />;
    if (config.key === 'plan') return <PlanRenderer text={content} />;
    return <PlainText text={content} />;
  };

  return (
    <View
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.borderColor,
        borderWidth: 1.5,
        borderRadius: 18,
        marginBottom: 14,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomColor: config.borderColor,
          borderBottomWidth: 1.5,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: config.badgeBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          <MaterialCommunityIcons
            name={config.icon as any}
            size={20}
            color={config.accentColor}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: config.accentColor,
              fontWeight: '800',
              fontSize: 15,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {config.label}
          </Text>
          <Text style={{ color: config.accentColor, fontSize: 11, opacity: 0.7, marginTop: 1 }}>
            {config.subtitle}
          </Text>
        </View>
        {editMode && (
          <View
            style={{
              backgroundColor: config.badgeBg,
              borderColor: config.borderColor,
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: config.accentColor, fontSize: 11, fontWeight: '700' }}>
              Editing
            </Text>
          </View>
        )}
      </View>
      <View style={{ padding: 16 }}>{renderContent()}</View>
    </View>
  );
}

function LabelLegend() {
  const labels: { type: LabelType; desc: string }[] = [
    { type: 'ordered', desc: 'Doctor explicitly ordered' },
    { type: 'inferred', desc: 'AI clinical logic' },
    { type: 'verify_dose', desc: 'Dose needs confirmation' },
    { type: 'verify_use', desc: 'Medication not mentioned — AI suggestion' },
    { type: 'consider', desc: 'Test not ordered — AI suggestion' },
    { type: 'differential', desc: 'Possible alternate diagnosis' },
  ];
  return (
    <View
      style={{
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '800',
          color: '#64748b',
          marginBottom: 8,
          letterSpacing: 0.5,
        }}
      >
        LABEL GUIDE
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {labels.map(({ type, desc }) => {
          const s = LABEL_STYLES[type];
          return (
            <View key={type} style={{ flexDirection: 'row', alignItems: 'center', width: '47%' }}>
              <View
                style={{
                  backgroundColor: s.bg,
                  borderColor: s.border,
                  borderWidth: 1,
                  borderRadius: 4,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  marginRight: 5,
                }}
              >
                <Text style={{ color: s.text, fontSize: 9, fontWeight: '700' }}>{s.short}</Text>
              </View>
              <Text style={{ color: '#94a3b8', fontSize: 10, flex: 1 }} numberOfLines={1}>
                {desc}
              </Text>
            </View>
          );
        })}
      </View>
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
  }
  return String(err);
}

async function getSessionDoctorId(): Promise<number | null> {
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
}

export default function SoapReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    appointment_id?: string;
    patient_id?: string;
    queue_token?: string;
    patient_name?: string;
    patient_code?: string;
    from_queue?: string;
  }>();

  const consultationId = params.id ? Number(params.id) : NaN;
  const appointmentId = params.appointment_id ? Number(params.appointment_id) : null;
  const patientId = params.patient_id ? Number(params.patient_id) : null;
  const fromQueue = params.from_queue === '1' || (!!appointmentId && !Number.isNaN(appointmentId));

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [consultationStatus, setConsultationStatus] = useState<string>('');
  const [soapRaw, setSoapRaw] = useState('');
  const [soapSections, setSoapSections] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState(false);
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  const [isApproving, setIsApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  const applySoap = (raw: string, status: string) => {
    const parsed = parseSOAPNote(raw);
    setSoapRaw(raw);
    setSoapSections(parsed);
    setEditedSections(parsed);
    setConsultationStatus(status);
    if ((status || '').toLowerCase() === 'completed') {
      setApproved(true);
      setEditMode(false);
    }
  };

  const loadSoap = useCallback(async () => {
    if (!consultationId || Number.isNaN(consultationId)) {
      setLoadError('Missing consultation ID.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${API_URL}/consultation/${consultationId}/status`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          getErrorMessage(data) || `Unable to load SOAP note (${res.status}).`
        );
      }
      const status = String(data?.status || '');
      const note = typeof data?.soap_note === 'string' ? data.soap_note.trim() : '';

      if (!['pending_approval', 'completed'].includes(status)) {
        throw new Error(
          status === 'processing' || status === 'queued'
            ? 'SOAP note is still processing. Please go back and wait.'
            : `SOAP note is not available for review (status: ${status || 'unknown'}).`
        );
      }
      if (!note) {
        throw new Error('No SOAP note was returned for this consultation.');
      }
      applySoap(note, status);
    } catch (e) {
      setSoapRaw('');
      setSoapSections({});
      setEditedSections({});
      setLoadError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [consultationId]);

  useEffect(() => {
    loadSoap();
  }, [loadSoap]);

  const buildRawFromEdited = () =>
    SOAP_CONFIG.filter((c) => editedSections[c.key]?.trim())
      .map((c) => `**${c.label}:**\n${editedSections[c.key].trim()}`)
      .join('\n\n');

  const handleApprove = async () => {
    if (!consultationId || Number.isNaN(consultationId) || isApproving || approved) return;
    setIsApproving(true);
    try {
      const finalSoap = editMode ? buildRawFromEdited() : soapRaw;
      if (!finalSoap.trim()) {
        throw new Error('Cannot approve an empty SOAP note.');
      }
      const doctorId = await getSessionDoctorId();
      const res = await fetch(`${API_URL}/consultation/${consultationId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_soap: finalSoap, doctor_id: doctorId }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(
          getErrorMessage(errBody) ||
            `Unable to approve the SOAP note (${res.status}). Please try again.`
        );
      }
      setSoapRaw(finalSoap);
      const parsed = parseSOAPNote(finalSoap);
      setSoapSections(parsed);
      setEditedSections(parsed);
      setEditMode(false);
      setApproved(true);
      setConsultationStatus('completed');
    } catch (e) {
      Alert.alert('Approval Failed', getErrorMessage(e));
    } finally {
      setIsApproving(false);
    }
  };

  const handleCompleteConsultation = () => {
    if (fromQueue) {
      router.replace('/(doctor)/queue/patient_queue');
    } else {
      router.replace('/(doctor)/dashboard');
    }
  };

  const displaySections = editMode ? editedSections : soapSections;
  const hasAnySection = Object.values(displaySections).some((v) => !!v?.trim());

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 60 : 40,
        paddingBottom: 60,
      }}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          backgroundColor: '#fff',
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          borderWidth: 1,
          borderColor: '#e2e8f0',
        }}
      >
        <MaterialCommunityIcons name="chevron-left" size={28} color="#1e293b" />
      </TouchableOpacity>

      <Text style={{ fontSize: 28, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 }}>
        SOAP Review
      </Text>
      <Text style={{ color: '#64748b', fontSize: 14, fontWeight: '500', marginTop: 4, marginBottom: 16 }}>
        {approved
          ? 'Approved clinical documentation'
          : 'AI-generated note — doctor approval required'}
      </Text>

      <View
        style={{
          backgroundColor: '#f0fdfa',
          borderWidth: 1,
          borderColor: '#99f6e4',
          borderRadius: 16,
          padding: 14,
          marginBottom: 20,
        }}
      >
        {params.patient_name ? (
          <Text style={{ color: '#0f172a', fontSize: 16, fontWeight: '800' }}>
            {params.patient_name}
            {params.patient_code ? (
              <Text style={{ color: '#64748b', fontWeight: '600' }}> · {params.patient_code}</Text>
            ) : null}
          </Text>
        ) : (
          <Text style={{ color: '#0f172a', fontSize: 15, fontWeight: '700' }}>
            Consultation #{Number.isNaN(consultationId) ? '—' : consultationId}
          </Text>
        )}
        <Text style={{ color: '#0d9488', fontSize: 12, fontWeight: '700', marginTop: 6 }}>
          Visit {params.queue_token || (appointmentId ? `APPT-${appointmentId}` : '—')}
        </Text>
        <Text style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>
          {[
            !Number.isNaN(consultationId) ? `consultation_id: ${consultationId}` : null,
            patientId != null && !Number.isNaN(patientId) ? `patient_id: ${patientId}` : null,
            appointmentId != null && !Number.isNaN(appointmentId)
              ? `appointment_id: ${appointmentId}`
              : null,
            consultationStatus ? `status: ${consultationStatus}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 48, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={{ color: '#64748b', marginTop: 12, fontWeight: '600' }}>
            Loading SOAP note…
          </Text>
        </View>
      ) : loadError ? (
        <View
          style={{
            backgroundColor: '#fef2f2',
            borderColor: '#fca5a5',
            borderWidth: 1,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <Text style={{ color: '#991b1b', fontWeight: '800', fontSize: 16, marginBottom: 8 }}>
            Unable to load SOAP
          </Text>
          <Text style={{ color: '#7f1d1d', fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
            {loadError}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                flex: 1,
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: '#334155' }}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={loadSoap}
              style={{
                flex: 1,
                backgroundColor: '#0d9488',
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: '#fff' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {approved ? (
            <View
              style={{
                backgroundColor: '#f0fdf4',
                borderColor: '#86efac',
                borderWidth: 1.5,
                borderRadius: 16,
                padding: 16,
                marginBottom: 18,
                alignItems: 'center',
              }}
            >
              <MaterialCommunityIcons name="check-circle" size={36} color="#15803d" />
              <Text
                style={{
                  color: '#14532d',
                  fontSize: 18,
                  fontWeight: '800',
                  marginTop: 8,
                  textAlign: 'center',
                }}
              >
                SOAP Note Saved & Approved
              </Text>
              <Text
                style={{
                  color: '#166534',
                  fontSize: 13,
                  marginTop: 4,
                  textAlign: 'center',
                  fontWeight: '500',
                }}
              >
                Documentation is finalized for this consultation.
              </Text>
            </View>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>
                  Review & Edit
                </Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Confirm each section before approving
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditMode(!editMode)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: editMode ? '#0f172a' : '#f1f5f9',
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: editMode ? '#0f172a' : '#cbd5e1',
                }}
              >
                <MaterialCommunityIcons
                  name={editMode ? 'check-bold' : 'pencil-outline'}
                  size={16}
                  color={editMode ? 'white' : '#475569'}
                />
                <Text
                  style={{
                    color: editMode ? 'white' : '#475569',
                    fontWeight: '700',
                    fontSize: 13,
                    marginLeft: 6,
                  }}
                >
                  {editMode ? 'Done' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!approved && <LabelLegend />}

          {!hasAnySection ? (
            <Text style={{ color: '#b91c1c', fontWeight: '600', marginBottom: 16 }}>
              SOAP sections could not be parsed. Use Edit to enter content, or go back.
            </Text>
          ) : null}

          {SOAP_CONFIG.map((config) => (
            <SOAPSectionCard
              key={config.key}
              config={config}
              content={displaySections[config.key] || ''}
              editMode={editMode && !approved}
              onEdit={(text) => setEditedSections((prev) => ({ ...prev, [config.key]: text }))}
            />
          ))}

          {!approved ? (
            <TouchableOpacity
              onPress={handleApprove}
              disabled={isApproving}
              style={{
                backgroundColor: '#0d9488',
                borderRadius: 16,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isApproving ? 0.6 : 1,
                marginTop: 8,
              }}
            >
              {isApproving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <MaterialCommunityIcons name="check-circle-outline" size={22} color="white" />
              )}
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 16, marginLeft: 10 }}>
                {isApproving ? 'Saving…' : 'Save & Approve SOAP'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleCompleteConsultation}
              style={{
                backgroundColor: '#0f172a',
                borderRadius: 16,
                paddingVertical: 18,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
              }}
            >
              <MaterialCommunityIcons name="check-all" size={22} color="white" />
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 16, marginLeft: 10 }}>
                Complete Consultation
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}

function stripMarkdown(text: string) {
  if (!text) return text;
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*{1,2}([^*\n]+)\*{1,2}/g, "$1")
    .replace(/_{1,2}([^_\n]+)_{1,2}/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/✅\s*CLINICAL ENDORSEMENT[^\n]*/g, "")
    .trim();
}

export const SOAP_KEYS = ["subjective", "objective", "assessment", "plan"] as const;
export type SoapKey = (typeof SOAP_KEYS)[number];

export const SOAP_LABELS: Record<SoapKey, string> = {
  subjective: "Subjective",
  objective: "Objective",
  assessment: "Assessment",
  plan: "Plan",
};

export function parseSoapNote(raw: string): Record<SoapKey, string> {
  const sections: Record<SoapKey, string> = { subjective: "", objective: "", assessment: "", plan: "" };
  const headerRe = /(?:^|\n)[^\n]*?\*{0,2}(Subjective|Objective|Assessment|Plan)\*{0,2}[:\s—\-]*\n/gi;
  const matches: { name: string; end: number; start: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(raw)) !== null) {
    matches.push({ name: match[1].toLowerCase(), start: match.index, end: match.index + match[0].length });
  }
  for (let index = 0; index < matches.length; index += 1) {
    const { name, end } = matches[index];
    const contentEnd = index + 1 < matches.length ? matches[index + 1].start : raw.length;
    if (name in sections) sections[name as SoapKey] = stripMarkdown(raw.slice(end, contentEnd));
  }
  if (!Object.values(sections).some((value) => value.length > 0)) {
    sections.subjective = stripMarkdown(raw);
  }
  return sections;
}

export function buildSoapFromSections(sections: Record<SoapKey, string>) {
  return SOAP_KEYS.filter((key) => sections[key]?.trim())
    .map((key) => `**${SOAP_LABELS[key]}:**\n${sections[key].trim()}`)
    .join("\n\n");
}

import type { CalendarId } from "@/lib/calendar/calendars";

import { seededInt } from "./random";

/**
 * The synthetic organisation.
 *
 * Every trap in PLAN §12 is deliberately present, because fixtures that only contain the
 * happy path hide the bugs until integration:
 *
 *   - non-uniform depth      Egypt, Australia, Singapore and Brazil have no cluster tier
 *   - both hemispheres       Australia and Brazil run a January academic year
 *   - no prior-year data     Dubai's newest school opened in the current academic year
 *   - sparse KPIs            some countries do not report some metrics at all
 *   - no senior years        two primary-only schools cannot have a placement rate
 *   - long, non-ASCII names  one Arabic school name that will break a naive layout
 *   - several currencies     including one that collapsed against the reporting currency
 *
 * All names are invented. No real client data, ever (PLAN §20).
 */

export const CURRENT_ACADEMIC_YEAR = "ay-2025";
export const AS_OF = "2026-03-31";

export type OrgLevel = "group" | "region" | "country" | "cluster" | "school";

export interface SchoolMeta {
  calendarId: CalendarId;
  currency: string;
  /** Academic year the school opened. Equal to the current year ⇒ no prior-year data. */
  openedAy: string;
  /** Peer band for anonymised comparison (PLAN §1.5). */
  peerBand: string;
  curriculum: "British" | "IB" | "American";
  capacity: number;
  enrolled: number;
  hasSeniorYears: boolean;
}

export interface OrgNode {
  id: string;
  level: OrgLevel;
  label: string;
  children: OrgNode[];
  meta?: SchoolMeta;
  /** KPI ids this subtree does not report at all — a realistic source of null cells. */
  unreportedKpis?: readonly string[];
}

interface SchoolSpec {
  id: string;
  label: string;
  curriculum?: SchoolMeta["curriculum"];
  capacity?: number;
  fill?: number;
  openedAy?: string;
  hasSeniorYears?: boolean;
}

interface CountrySpec {
  id: string;
  label: string;
  calendarId: CalendarId;
  currency: string;
  unreportedKpis?: readonly string[];
  /** Absent ⇒ this country has no cluster tier, and schools hang off the country. */
  clusters?: { id: string; label: string; schools: SchoolSpec[] }[];
  schools?: SchoolSpec[];
}

const school = (id: string, label: string, extra: Partial<SchoolSpec> = {}): SchoolSpec => ({
  id,
  label,
  ...extra,
});

const SPEC: { id: string; label: string; countries: CountrySpec[] }[] = [
  {
    id: "emea",
    label: "EMEA",
    countries: [
      {
        id: "uae",
        label: "United Arab Emirates",
        calendarId: "northern",
        currency: "AED",
        clusters: [
          {
            id: "dubai",
            label: "Dubai",
            schools: [
              school("dxb-01", "Al Barsha International School", { curriculum: "British", capacity: 1850 }),
              school("dxb-02", "Jumeirah Park Academy", { curriculum: "IB", capacity: 1420 }),
              // Deliberately long and non-ASCII: breaks naive truncation and RTL-naive layout.
              school("dxb-03", "مدرسة الشيخ زايد الدولية للتعليم المتقدم", { curriculum: "British", capacity: 2100 }),
              school("dxb-04", "Mirdif Preparatory School", { curriculum: "British", capacity: 760, hasSeniorYears: false }),
              school("dxb-05", "Dubai Creek College", { curriculum: "IB", capacity: 1180 }),
              // Opened this academic year ⇒ every prior-period baseline is null.
              school("dxb-06", "Dubai South Academy", { curriculum: "British", capacity: 900, fill: 0.41, openedAy: CURRENT_ACADEMIC_YEAR }),
            ],
          },
          {
            id: "auh",
            label: "Abu Dhabi",
            schools: [
              school("auh-01", "Corniche International School", { curriculum: "British", capacity: 1600 }),
              school("auh-02", "Yas Island Academy", { curriculum: "IB", capacity: 1340 }),
              school("auh-03", "Al Reem Preparatory", { curriculum: "British", capacity: 690, hasSeniorYears: false }),
              school("auh-04", "Khalifa City College", { curriculum: "American", capacity: 1220 }),
            ],
          },
        ],
      },
      {
        id: "uk",
        label: "United Kingdom",
        calendarId: "northern",
        currency: "GBP",
        clusters: [
          {
            id: "lon",
            label: "London",
            schools: [
              school("lon-01", "Kensington Gate School", { curriculum: "British", capacity: 1250 }),
              school("lon-02", "Docklands International", { curriculum: "IB", capacity: 980 }),
              school("lon-03", "Richmond Hill Academy", { curriculum: "British", capacity: 1410 }),
              school("lon-04", "Camden Park College", { curriculum: "British", capacity: 870 }),
              school("lon-05", "Greenwich Meridian School", { curriculum: "IB", capacity: 1120 }),
            ],
          },
          {
            id: "nor",
            label: "North England",
            schools: [
              school("nor-01", "Pennine Valley School", { curriculum: "British", capacity: 940 }),
              school("nor-02", "Mersey Gate Academy", { curriculum: "British", capacity: 1080 }),
              school("nor-03", "Yorkshire Dales College", { curriculum: "British", capacity: 760 }),
            ],
          },
        ],
      },
      {
        id: "eg",
        label: "Egypt",
        calendarId: "northern",
        currency: "EGP",
        // Non-uniform depth: no cluster tier at all.
        // And a genuinely sparse reporter — value-added scoring is not collected here.
        unreportedKpis: ["progressScore", "parentNps"],
        schools: [
          school("eg-01", "New Cairo International", { curriculum: "British", capacity: 1680 }),
          school("eg-02", "Maadi House School", { curriculum: "IB", capacity: 1240 }),
          school("eg-03", "Zamalek Preparatory", { curriculum: "British", capacity: 820 }),
          school("eg-04", "Alexandria Bay College", { curriculum: "American", capacity: 1050 }),
          school("eg-05", "Sheikh Zayed Academy", { curriculum: "British", capacity: 1390 }),
        ],
      },
    ],
  },
  {
    id: "apac",
    label: "Asia Pacific",
    countries: [
      {
        id: "au",
        label: "Australia",
        // Southern hemisphere: January academic year. The whole reason lib/calendar exists.
        calendarId: "southern",
        currency: "AUD",
        schools: [
          school("au-01", "Harbour Point Grammar", { curriculum: "IB", capacity: 1520 }),
          school("au-02", "Blue Mountains College", { curriculum: "British", capacity: 980 }),
          school("au-03", "Port Melbourne Academy", { curriculum: "IB", capacity: 1270 }),
          school("au-04", "Adelaide Hills School", { curriculum: "British", capacity: 640 }),
        ],
      },
      {
        id: "sg",
        label: "Singapore",
        calendarId: "northern",
        currency: "SGD",
        schools: [
          school("sg-01", "Marina East International", { curriculum: "IB", capacity: 1740 }),
          school("sg-02", "Bukit Timah College", { curriculum: "British", capacity: 1310 }),
          school("sg-03", "Sentosa Cove Academy", { curriculum: "American", capacity: 890 }),
        ],
      },
    ],
  },
  {
    id: "amer",
    label: "Americas",
    countries: [
      {
        id: "br",
        label: "Brazil",
        calendarId: "southern",
        currency: "BRL",
        unreportedKpis: ["facilityUtilisation"],
        schools: [
          school("br-01", "São Paulo International", { curriculum: "IB", capacity: 1630 }),
          school("br-02", "Rio Jardim Academy", { curriculum: "American", capacity: 1180 }),
          school("br-03", "Curitiba Park School", { curriculum: "British", capacity: 720 }),
        ],
      },
      {
        id: "mx",
        label: "Mexico",
        calendarId: "northern",
        currency: "MXN",
        schools: [
          school("mx-01", "Polanco International", { curriculum: "American", capacity: 1420 }),
          school("mx-02", "Guadalajara Highlands", { curriculum: "IB", capacity: 1050 }),
          school("mx-03", "Monterrey Valley College", { curriculum: "American", capacity: 930 }),
        ],
      },
      {
        id: "us",
        label: "United States",
        calendarId: "northern",
        currency: "USD",
        schools: [
          school("us-01", "Hudson River Academy", { curriculum: "American", capacity: 1580 }),
          school("us-02", "Bay Area International", { curriculum: "IB", capacity: 1340 }),
          school("us-03", "Lakeshore Preparatory", { curriculum: "American", capacity: 810, hasSeniorYears: false }),
        ],
      },
    ],
  },
];

/** Peer band: size and curriculum, so comparison is defensible (PLAN §1.5). */
export function peerBandFor(capacity: number, curriculum: SchoolMeta["curriculum"]): string {
  const size = capacity >= 1500 ? "large" : capacity >= 1000 ? "mid" : "small";
  return `${size}-${curriculum.toLowerCase()}`;
}

function buildSchool(spec: SchoolSpec, country: CountrySpec): OrgNode {
  const capacity = spec.capacity ?? 1000;
  const curriculum = spec.curriculum ?? "British";
  const fill = spec.fill ?? seededFill(spec.id);
  return {
    id: `sch-${spec.id}`,
    level: "school",
    label: spec.label,
    children: [],
    meta: {
      calendarId: country.calendarId,
      currency: country.currency,
      openedAy: spec.openedAy ?? "ay-2018",
      peerBand: peerBandFor(capacity, curriculum),
      curriculum,
      capacity,
      enrolled: Math.round(capacity * fill),
      hasSeniorYears: spec.hasSeniorYears ?? true,
    },
  };
}

function seededFill(id: string): number {
  return seededInt(72, 98, "fill", id) / 100;
}

function buildCountry(spec: CountrySpec): OrgNode {
  const children = spec.clusters
    ? spec.clusters.map((cluster) => ({
        id: cluster.id,
        level: "cluster" as const,
        label: cluster.label,
        children: cluster.schools.map((s) => buildSchool(s, spec)),
      }))
    : (spec.schools ?? []).map((s) => buildSchool(s, spec));

  return {
    id: spec.id,
    level: "country",
    label: spec.label,
    children,
    unreportedKpis: spec.unreportedKpis,
  };
}

/** The whole tree. Built once — it is static data, not a query. */
export const ORG: OrgNode = {
  id: "group",
  level: "group",
  label: "Nova Schools Group",
  children: SPEC.map((region) => ({
    id: region.id,
    level: "region" as const,
    label: region.label,
    children: region.countries.map(buildCountry),
  })),
};

const INDEX = new Map<string, { node: OrgNode; path: OrgNode[] }>();

(function indexTree(node: OrgNode, path: OrgNode[]) {
  INDEX.set(node.id, { node, path });
  for (const child of node.children) indexTree(child, [...path, node]);
})(ORG, []);

export function findNode(id: string): OrgNode | undefined {
  return INDEX.get(id)?.node;
}

/** Ancestors of `id`, outermost first, excluding the node itself. */
export function pathTo(id: string): OrgNode[] {
  return INDEX.get(id)?.path ?? [];
}

export function allNodes(): OrgNode[] {
  return [...INDEX.values()].map((entry) => entry.node);
}

export function schoolsUnder(id: string): OrgNode[] {
  const start = findNode(id);
  if (!start) return [];
  const out: OrgNode[] = [];
  const walk = (node: OrgNode) => {
    if (node.level === "school") out.push(node);
    else node.children.forEach(walk);
  };
  walk(start);
  return out;
}

/** Which KPIs a node cannot report, inherited from its country. */
export function unreportedFor(id: string): readonly string[] {
  const node = findNode(id);
  if (!node) return [];
  const chain = [...pathTo(id), node];
  return chain.flatMap((ancestor) => ancestor.unreportedKpis ?? []);
}

/** The academic calendar in force at a node, inherited from its country. */
export function calendarIdFor(id: string): CalendarId {
  const node = findNode(id);
  if (node?.meta) return node.meta.calendarId;
  const schools = schoolsUnder(id);
  // Above country level the group spans both hemispheres; the northern calendar is the
  // group reporting default, and the UI must say so rather than pretend it is universal.
  return schools.length && schools.every((s) => s.meta!.calendarId === "southern")
    ? "southern"
    : "northern";
}

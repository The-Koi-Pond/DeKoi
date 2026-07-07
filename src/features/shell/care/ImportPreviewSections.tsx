import type {
  DeKoiLegacyImportPreview,
  DeKoiStorageBundleCounts,
  DeKoiStorageBundlePreview,
} from "../../runtime";

interface BundleCountsProps {
  counts: DeKoiStorageBundleCounts;
}

interface BundleImportPreviewProps {
  preview: DeKoiStorageBundlePreview;
  replaceConfirmed: boolean;
  onReplaceConfirmedChange: (confirmed: boolean) => void;
}

interface LegacyImportPreviewProps {
  preview: DeKoiLegacyImportPreview;
  importConfirmed: boolean;
  onImportConfirmedChange: (confirmed: boolean) => void;
}

interface CountListItem {
  value: number;
  label: string;
}

export function BundleCounts({ counts }: BundleCountsProps) {
  return (
    <CountList
      items={[
        { value: counts.characters, label: "companions" },
        { value: counts.personas, label: "personas" },
        { value: counts.roleplayThreads, label: "Roleplay threads" },
        { value: counts.roleplayEntries, label: "Roleplay turns" },
        { value: counts.lorebooks, label: "lorebooks" },
        { value: counts.lorebookEntries, label: "lore entries" },
        { value: counts.loreRuntimeStates, label: "lore runtime states" },
        { value: counts.loreRuntimeEntries, label: "lore runtime entries" },
        { value: counts.macroVariableStates, label: "macro variable scopes" },
        { value: counts.macroVariables, label: "macro variables" },
        { value: counts.providerConnections, label: "connections" },
        { value: counts.messengerThreads, label: "threads" },
        { value: counts.messengerMessages, label: "messages" },
        { value: counts.rippleStates, label: "Ripple states" },
        { value: counts.ripples, label: "Ripples" },
      ]}
    />
  );
}

export function BundleImportPreview({
  preview,
  replaceConfirmed,
  onReplaceConfirmedChange,
}: BundleImportPreviewProps) {
  return (
    <div className="bundle-preview">
      <b>Import preview</b>
      <BundleCounts counts={preview.counts} />
      <ImportWarnings warnings={preview.warnings} />
      <label className="catalog-check bundle-confirm">
        <input
          type="checkbox"
          checked={replaceConfirmed}
          onChange={(event) => onReplaceConfirmedChange(event.target.checked)}
        />
        Replace current DeKoi records with this bundle
      </label>
    </div>
  );
}

export function LegacyImportPreview({
  preview,
  importConfirmed,
  onImportConfirmedChange,
}: LegacyImportPreviewProps) {
  return (
    <div className="bundle-preview">
      <b>Legacy import preview</b>
      <LegacyImportCounts counts={preview.counts} />
      <p className="bundle-note">Source: {preview.data.sourceLabel}</p>
      <ImportWarnings warnings={preview.warnings} />
      <label className="catalog-check bundle-confirm">
        <input
          type="checkbox"
          checked={importConfirmed}
          onChange={(event) => onImportConfirmedChange(event.target.checked)}
        />
        Add converted records to DeKoi
      </label>
    </div>
  );
}

function ImportWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="bundle-warnings">
      {warnings.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
    </div>
  );
}

function CountList({ items }: { items: CountListItem[] }) {
  return (
    <div className="bundle-counts">
      {items.map(({ value, label }) => (
        <span key={label}>
          <b>{value}</b> {label}
        </span>
      ))}
    </div>
  );
}

function LegacyImportCounts({ counts }: { counts: DeKoiLegacyImportPreview["counts"] }) {
  return (
    <CountList
      items={[
        { value: counts.characters, label: "companions" },
        { value: counts.personas, label: "personas" },
        { value: counts.macroVariableStates, label: "macro variable scopes" },
        { value: counts.macroVariables, label: "macro variables" },
        { value: counts.providerConnections, label: "connections" },
        { value: counts.messengerThreads, label: "Messenger threads" },
        { value: counts.messengerMessages, label: "messages" },
      ]}
    />
  );
}

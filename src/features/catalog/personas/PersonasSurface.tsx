import { useState } from "react";
import type { PersonaNoteRole, PersonaRecord } from "../../../engine/contracts/types/persona";
import type { PersonaRecordInput } from "../../../engine/catalog/persona-actions";
import type {
  NavCatalogState,
  NavPersonaActions,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import { LorebookMultiSelect } from "../../../shared/ui/LorebookMultiSelect";
import { CatalogSurfaceBanner } from "../shared/CatalogSurfaceBanner";
import "../shared/CatalogSurface.css";

interface PersonasSurfaceProps {
  nav: PersonasSurfaceNav;
}

export type PersonasSurfaceNav = Pick<NavCatalogState, "lorebooks" | "personas"> &
  Pick<NavPersonaActions, "createPersona" | "deletePersona" | "updatePersona"> &
  Pick<NavViewActions, "setView"> &
  Pick<NavViewState, "view">;

interface DraftState {
  displayName: string;
  nickname: string;
  description: string;
  personality: string;
  scenario: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  creator: string;
  characterVersion: string;
  creatorNotes: string;
  tags: string;
  characterNote: string;
  characterNoteDepth: string;
  characterNoteRole: PersonaNoteRole;
  talkativeness: string;
  avatarUrl: string;
  lorebookIds: string[];
}

const EMPTY_DRAFT: DraftState = {
  displayName: "",
  nickname: "",
  description: "",
  personality: "",
  scenario: "",
  systemPrompt: "",
  postHistoryInstructions: "",
  creator: "",
  characterVersion: "",
  creatorNotes: "",
  tags: "",
  characterNote: "",
  characterNoteDepth: "4",
  characterNoteRole: "system",
  talkativeness: "50",
  avatarUrl: "",
  lorebookIds: [],
};

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asTextArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asNoteRole(value: unknown): PersonaNoteRole {
  return value === "user" || value === "assistant" ? value : "system";
}

function asNumberString(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : String(fallback);
}

function joinTags(values: unknown) {
  return asTextArray(values).join(", ");
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function draftFromPersona(record: PersonaRecord): DraftState {
  return {
    displayName: asText(record.displayName),
    nickname: asNullableText(record.nickname) ?? "",
    description: asText(record.description),
    personality: asText(record.personality),
    scenario: asText(record.scenario),
    systemPrompt: asText(record.systemPrompt),
    postHistoryInstructions: asText(record.postHistoryInstructions),
    creator: asText(record.creator),
    characterVersion: asText(record.characterVersion),
    creatorNotes: asText(record.creatorNotes),
    tags: joinTags(record.tags),
    characterNote: asText(record.characterNote),
    characterNoteDepth: asNumberString(record.characterNoteDepth, 4),
    characterNoteRole: asNoteRole(record.characterNoteRole),
    talkativeness: asNumberString(record.talkativeness, 50),
    avatarUrl: asNullableText(record.avatarUrl) ?? "",
    lorebookIds: asTextArray(record.lorebookIds),
  };
}

function draftToInput(draft: DraftState): PersonaRecordInput {
  return {
    displayName: draft.displayName.trim(),
    nickname: draft.nickname.trim() || null,
    description: draft.description.trim(),
    personality: draft.personality.trim(),
    scenario: draft.scenario.trim(),
    systemPrompt: draft.systemPrompt.trim(),
    postHistoryInstructions: draft.postHistoryInstructions.trim(),
    creator: draft.creator.trim(),
    characterVersion: draft.characterVersion.trim(),
    creatorNotes: draft.creatorNotes.trim(),
    tags: splitTags(draft.tags),
    characterNote: draft.characterNote.trim(),
    characterNoteDepth: parseNumber(draft.characterNoteDepth, 4),
    characterNoteRole: draft.characterNoteRole,
    talkativeness: parseNumber(draft.talkativeness, 50),
    avatarUrl: draft.avatarUrl.trim() || null,
    lorebookIds: draft.lorebookIds,
  };
}

function draftsMatch(left: DraftState, right: DraftState) {
  return JSON.stringify(draftToInput(left)) === JSON.stringify(draftToInput(right));
}

interface PersonaEditorProps {
  editingId: string | null;
  initialDraft: DraftState;
  lorebooks: PersonasSurfaceNav["lorebooks"];
  onBack: () => void;
  onDelete?: () => void;
  onSave: (input: PersonaRecordInput) => void;
}

function PersonaEditor({
  editingId,
  initialDraft,
  lorebooks,
  onBack,
  onDelete,
  onSave,
}: PersonaEditorProps) {
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const hasPendingChanges = !draftsMatch(draft, initialDraft);

  function handleSave() {
    const input = draftToInput(draft);
    if (!input.displayName) return;
    onSave(input);
  }

  return (
    <>
      <CatalogSurfaceBanner
        avatarAlt={draft.displayName || "Persona avatar"}
        avatarUrl={draft.avatarUrl}
        icon="◎"
        onBack={onBack}
        onAvatarChange={(avatarUrl) => setDraft({ ...draft, avatarUrl })}
        onDelete={onDelete}
        onSave={handleSave}
        saveLabel={editingId ? "Save Changes" : "Create"}
        saveState={hasPendingChanges ? "pending" : "clean"}
        subtitle={draft.nickname || "No nickname"}
        title={draft.displayName || "New Persona"}
      />
      <div className="pond-inner catalog-inner catalog-editor-only">
        <div className="catalog-editor persona-card-editor">
          <section className="catalog-editor-section" aria-labelledby="pers-core-heading">
            <h4 id="pers-core-heading">Card</h4>
            <div className="catalog-editor-grid">
              <div className="catalog-editor-field">
                <label htmlFor="pers-name">Name</label>
                <input
                  id="pers-name"
                  className="pondinput"
                  type="text"
                  value={draft.displayName}
                  onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                  placeholder="e.g. Xel"
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="pers-nickname">Nickname</label>
                <input
                  id="pers-nickname"
                  className="pondinput"
                  type="text"
                  value={draft.nickname}
                  onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="pers-desc">Description</label>
              <textarea
                id="pers-desc"
                className="pondinput pondtextarea"
                rows={5}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Persona description"
              />
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="pers-personality">Personality Summary</label>
              <textarea
                id="pers-personality"
                className="pondinput pondtextarea"
                rows={3}
                value={draft.personality}
                onChange={(e) => setDraft({ ...draft, personality: e.target.value })}
                placeholder="Brief personality"
              />
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="pers-scenario">Scenario</label>
              <textarea
                id="pers-scenario"
                className="pondinput pondtextarea"
                rows={3}
                value={draft.scenario}
                onChange={(e) => setDraft({ ...draft, scenario: e.target.value })}
                placeholder="Dialogue context"
              />
            </div>
          </section>

          <section className="catalog-editor-section" aria-labelledby="pers-prompts-heading">
            <h4 id="pers-prompts-heading">Advanced Definitions</h4>
            <div className="catalog-editor-grid">
              <div className="catalog-editor-field">
                <label htmlFor="pers-system-prompt">Main/System Prompt</label>
                <textarea
                  id="pers-system-prompt"
                  className="pondinput pondtextarea"
                  rows={4}
                  value={draft.systemPrompt}
                  onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
                  placeholder="{{original}}"
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="pers-post-history">Post-History Instructions</label>
                <textarea
                  id="pers-post-history"
                  className="pondinput pondtextarea"
                  rows={4}
                  value={draft.postHistoryInstructions}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      postHistoryInstructions: e.target.value,
                    })
                  }
                  placeholder="{{original}}"
                />
              </div>
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="pers-note">Persona's Note</label>
              <textarea
                id="pers-note"
                className="pondinput pondtextarea"
                rows={3}
                value={draft.characterNote}
                onChange={(e) => setDraft({ ...draft, characterNote: e.target.value })}
                placeholder="Optional static note"
              />
            </div>
            <div className="catalog-editor-grid compact">
              <div className="catalog-editor-field">
                <label htmlFor="pers-note-depth">Depth</label>
                <input
                  id="pers-note-depth"
                  className="pondinput"
                  type="number"
                  min="0"
                  max="99"
                  value={draft.characterNoteDepth}
                  onChange={(e) => setDraft({ ...draft, characterNoteDepth: e.target.value })}
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="pers-note-role">Role</label>
                <select
                  id="pers-note-role"
                  className="pondinput"
                  value={draft.characterNoteRole}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      characterNoteRole: e.target.value as PersonaNoteRole,
                    })
                  }
                >
                  <option value="system">System</option>
                  <option value="user">User</option>
                  <option value="assistant">Assistant</option>
                </select>
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="pers-talkativeness">Talkativeness</label>
                <input
                  id="pers-talkativeness"
                  className="pondinput"
                  type="number"
                  min="0"
                  max="100"
                  value={draft.talkativeness}
                  onChange={(e) => setDraft({ ...draft, talkativeness: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="catalog-editor-section" aria-labelledby="pers-lore-heading">
            <h4 id="pers-lore-heading">Lorebooks</h4>
            <LorebookMultiSelect
              emptyMessage="No lorebooks have been created yet."
              idPrefix="pers-lorebook"
              label="Persona lorebooks"
              lorebooks={lorebooks}
              selectedLorebookIds={draft.lorebookIds}
              onChange={(lorebookIds) => setDraft({ ...draft, lorebookIds })}
            />
          </section>

          <section className="catalog-editor-section" aria-labelledby="pers-meta-heading">
            <h4 id="pers-meta-heading">Creator's Metadata</h4>
            <div className="catalog-editor-grid">
              <div className="catalog-editor-field">
                <label htmlFor="pers-creator">Created By</label>
                <input
                  id="pers-creator"
                  className="pondinput"
                  type="text"
                  value={draft.creator}
                  onChange={(e) => setDraft({ ...draft, creator: e.target.value })}
                  placeholder="Creator"
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="pers-version">Persona Version</label>
                <input
                  id="pers-version"
                  className="pondinput"
                  type="text"
                  value={draft.characterVersion}
                  onChange={(e) => setDraft({ ...draft, characterVersion: e.target.value })}
                  placeholder="Version"
                />
              </div>
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="pers-notes">Creator's Notes</label>
              <textarea
                id="pers-notes"
                className="pondinput pondtextarea"
                rows={4}
                value={draft.creatorNotes}
                onChange={(e) => setDraft({ ...draft, creatorNotes: e.target.value })}
                placeholder="Notes"
              />
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="pers-tags">Tags to Embed</label>
              <input
                id="pers-tags"
                className="pondinput"
                type="text"
                value={draft.tags}
                onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                placeholder="tag, tag"
              />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export function PersonasSurface({ nav }: PersonasSurfaceProps) {
  const activePersonaId = nav.view.kind === "personas" ? nav.view.personaId : null;
  const activePersona = activePersonaId
    ? (nav.personas.find((persona) => persona.id === activePersonaId) ?? null)
    : null;
  const isCreating = nav.view.kind === "personas" && nav.view.mode === "new";
  const editingId = activePersona?.id ?? null;
  const showEditor = isCreating || activePersona !== null;
  const initialDraft = activePersona ? draftFromPersona(activePersona) : EMPTY_DRAFT;

  function handleSave(input: PersonaRecordInput) {
    if (editingId) {
      nav.updatePersona(editingId, input);
      nav.setView({ kind: "personas", personaId: editingId });
      return;
    } else {
      const persona = nav.createPersona(input);
      nav.setView({ kind: "personas", personaId: persona.id });
    }
  }

  function handleBack() {
    nav.setView({ kind: "pond" });
  }

  function handleDelete() {
    if (!editingId) return;
    nav.deletePersona(editingId);
    nav.setView({ kind: "personas" });
  }

  return (
    <main className="pond catalog-surface">
      {showEditor ? (
        <PersonaEditor
          key={editingId ?? "new-persona"}
          editingId={editingId}
          initialDraft={initialDraft}
          lorebooks={nav.lorebooks}
          onBack={handleBack}
          onDelete={editingId ? handleDelete : undefined}
          onSave={handleSave}
        />
      ) : (
        <>
          <CatalogSurfaceBanner icon="◎" onBack={handleBack} title="Personas" />
          <div className="pond-inner catalog-inner catalog-editor-only">
            <div className="catalog-empty">Pick a persona from The Shoal or create a new one.</div>
          </div>
        </>
      )}
    </main>
  );
}

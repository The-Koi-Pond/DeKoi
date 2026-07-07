import { useState } from "react";
import type { CharacterNoteRole, CharacterRecord } from "../../../engine/contracts/types/character";
import type { CharacterRecordInput } from "../../../engine/catalog/character-actions";
import type {
  NavCatalogState,
  NavCharacterActions,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import { LorebookMultiSelect } from "../../../shared/ui/LorebookMultiSelect";
import { CatalogMacroTextarea } from "../shared/CatalogMacroTextarea";
import { CatalogSurfaceBanner } from "../shared/CatalogSurfaceBanner";
import "../shared/CatalogSurface.css";

interface CompanionsSurfaceProps {
  nav: CompanionsSurfaceNav;
}

export type CompanionsSurfaceNav = Pick<NavCatalogState, "characters" | "lorebooks"> &
  Pick<NavCharacterActions, "createCharacter" | "deleteCharacter" | "updateCharacter"> &
  Pick<NavViewActions, "setView"> &
  Pick<NavViewState, "view">;

interface DraftState {
  displayName: string;
  nickname: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  alternateGreetings: string;
  groupOnlyGreetings: string;
  exampleMessages: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  creator: string;
  characterVersion: string;
  creatorNotes: string;
  tags: string;
  characterNote: string;
  characterNoteDepth: string;
  characterNoteRole: CharacterNoteRole;
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
  firstMessage: "",
  alternateGreetings: "",
  groupOnlyGreetings: "",
  exampleMessages: "",
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

function asNoteRole(value: unknown): CharacterNoteRole {
  return value === "user" || value === "assistant" ? value : "system";
}

function asNumberString(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : String(fallback);
}

function joinBlocks(values: unknown) {
  return asTextArray(values).join("\n\n");
}

function splitBlocks(value: string) {
  return value
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
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

function draftFromCharacter(record: CharacterRecord): DraftState {
  return {
    displayName: asText(record.displayName),
    nickname: asNullableText(record.nickname) ?? "",
    description: asText(record.description),
    personality: asText(record.personality),
    scenario: asText(record.scenario),
    firstMessage: asText(record.firstMessage),
    alternateGreetings: joinBlocks(record.alternateGreetings),
    groupOnlyGreetings: joinBlocks(record.groupOnlyGreetings),
    exampleMessages: asText(record.exampleMessages),
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

function draftToInput(draft: DraftState): CharacterRecordInput {
  return {
    displayName: draft.displayName.trim(),
    nickname: draft.nickname.trim() || null,
    description: draft.description.trim(),
    personality: draft.personality.trim(),
    scenario: draft.scenario.trim(),
    firstMessage: draft.firstMessage.trim(),
    alternateGreetings: splitBlocks(draft.alternateGreetings),
    groupOnlyGreetings: splitBlocks(draft.groupOnlyGreetings),
    exampleMessages: draft.exampleMessages.trim(),
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

interface CompanionEditorProps {
  editingId: string | null;
  initialDraft: DraftState;
  lorebooks: CompanionsSurfaceNav["lorebooks"];
  onBack: () => void;
  onDelete?: () => void;
  onSave: (input: CharacterRecordInput) => void;
}

function CompanionEditor({
  editingId,
  initialDraft,
  lorebooks,
  onBack,
  onDelete,
  onSave,
}: CompanionEditorProps) {
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
        avatarAlt={draft.displayName || "Companion avatar"}
        avatarUrl={draft.avatarUrl}
        icon="⚇"
        onBack={onBack}
        onAvatarChange={(avatarUrl) => setDraft({ ...draft, avatarUrl })}
        onDelete={onDelete}
        onSave={handleSave}
        saveLabel={editingId ? "Save Changes" : "Create"}
        saveState={hasPendingChanges ? "pending" : "clean"}
        subtitle={draft.nickname || "No nickname"}
        title={draft.displayName || "New Companion"}
      />
      <div className="pond-inner catalog-inner catalog-editor-only">
        <div className="catalog-editor character-card-editor">
          <section className="catalog-editor-section" aria-labelledby="comp-core-heading">
            <h4 id="comp-core-heading">Card</h4>
            <div className="catalog-editor-grid">
              <div className="catalog-editor-field">
                <label htmlFor="comp-name">Name</label>
                <input
                  id="comp-name"
                  className="pondinput"
                  type="text"
                  value={draft.displayName}
                  onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                  placeholder="e.g. Hikari"
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="comp-nickname">Nickname</label>
                <input
                  id="comp-nickname"
                  className="pondinput"
                  type="text"
                  value={draft.nickname}
                  onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="comp-desc">Description</label>
              <CatalogMacroTextarea
                id="comp-desc"
                className="pondinput pondtextarea"
                rows={5}
                value={draft.description}
                onValueChange={(description) => setDraft({ ...draft, description })}
                placeholder="Character description"
              />
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="comp-personality">Personality Summary</label>
              <CatalogMacroTextarea
                id="comp-personality"
                className="pondinput pondtextarea"
                rows={3}
                value={draft.personality}
                onValueChange={(personality) => setDraft({ ...draft, personality })}
                placeholder="Brief personality"
              />
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="comp-scenario">Scenario</label>
              <CatalogMacroTextarea
                id="comp-scenario"
                className="pondinput pondtextarea"
                rows={3}
                value={draft.scenario}
                onValueChange={(scenario) => setDraft({ ...draft, scenario })}
                placeholder="Dialogue context"
              />
            </div>
          </section>

          <section className="catalog-editor-section" aria-labelledby="comp-greetings-heading">
            <h4 id="comp-greetings-heading">Messages</h4>
            <div className="catalog-editor-field">
              <label htmlFor="comp-first-message">First Message</label>
              <textarea
                id="comp-first-message"
                className="pondinput pondtextarea"
                rows={4}
                value={draft.firstMessage}
                onChange={(e) => setDraft({ ...draft, firstMessage: e.target.value })}
                placeholder="Opening message"
              />
            </div>
            <div className="catalog-editor-grid">
              <div className="catalog-editor-field">
                <label htmlFor="comp-alt-greetings">Alternate Greetings</label>
                <textarea
                  id="comp-alt-greetings"
                  className="pondinput pondtextarea"
                  rows={5}
                  value={draft.alternateGreetings}
                  onChange={(e) => setDraft({ ...draft, alternateGreetings: e.target.value })}
                  placeholder="Separate greetings with blank lines"
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="comp-group-greetings">Group-Only Greetings</label>
                <textarea
                  id="comp-group-greetings"
                  className="pondinput pondtextarea"
                  rows={5}
                  value={draft.groupOnlyGreetings}
                  onChange={(e) => setDraft({ ...draft, groupOnlyGreetings: e.target.value })}
                  placeholder="Separate greetings with blank lines"
                />
              </div>
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="comp-examples">Examples of Dialogue</label>
              <CatalogMacroTextarea
                id="comp-examples"
                className="pondinput pondtextarea"
                rows={7}
                value={draft.exampleMessages}
                onValueChange={(exampleMessages) => setDraft({ ...draft, exampleMessages })}
                placeholder="<START>"
              />
            </div>
          </section>

          <section className="catalog-editor-section" aria-labelledby="comp-prompts-heading">
            <h4 id="comp-prompts-heading">Advanced Definitions</h4>
            <div className="catalog-editor-grid">
              <div className="catalog-editor-field">
                <label htmlFor="comp-system-prompt">Main/System Prompt</label>
                <CatalogMacroTextarea
                  id="comp-system-prompt"
                  className="pondinput pondtextarea"
                  rows={4}
                  value={draft.systemPrompt}
                  onValueChange={(systemPrompt) => setDraft({ ...draft, systemPrompt })}
                  placeholder="Optional system prompt"
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="comp-post-history">Post-History Instructions</label>
                <CatalogMacroTextarea
                  id="comp-post-history"
                  className="pondinput pondtextarea"
                  rows={4}
                  value={draft.postHistoryInstructions}
                  onValueChange={(postHistoryInstructions) =>
                    setDraft({ ...draft, postHistoryInstructions })
                  }
                  placeholder="Optional post-history instructions"
                />
              </div>
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="comp-note">Character's Note</label>
              <CatalogMacroTextarea
                id="comp-note"
                className="pondinput pondtextarea"
                rows={3}
                value={draft.characterNote}
                onValueChange={(characterNote) => setDraft({ ...draft, characterNote })}
                placeholder="Optional static note"
              />
            </div>
            <div className="catalog-editor-grid compact">
              <div className="catalog-editor-field">
                <label htmlFor="comp-note-depth">Depth</label>
                <input
                  id="comp-note-depth"
                  className="pondinput"
                  type="number"
                  min="0"
                  max="99"
                  value={draft.characterNoteDepth}
                  onChange={(e) => setDraft({ ...draft, characterNoteDepth: e.target.value })}
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="comp-note-role">Role</label>
                <select
                  id="comp-note-role"
                  className="pondinput"
                  value={draft.characterNoteRole}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      characterNoteRole: e.target.value as CharacterNoteRole,
                    })
                  }
                >
                  <option value="system">System</option>
                  <option value="user">User</option>
                  <option value="assistant">Assistant</option>
                </select>
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="comp-talkativeness">Talkativeness</label>
                <input
                  id="comp-talkativeness"
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

          <section className="catalog-editor-section" aria-labelledby="comp-lore-heading">
            <h4 id="comp-lore-heading">Lorebooks</h4>
            <LorebookMultiSelect
              emptyMessage="No lorebooks have been created yet."
              idPrefix="comp-lorebook"
              label="Character lorebooks"
              lorebooks={lorebooks}
              selectedLorebookIds={draft.lorebookIds}
              onChange={(lorebookIds) => setDraft({ ...draft, lorebookIds })}
            />
          </section>

          <section className="catalog-editor-section" aria-labelledby="comp-meta-heading">
            <h4 id="comp-meta-heading">Creator's Metadata</h4>
            <div className="catalog-editor-grid">
              <div className="catalog-editor-field">
                <label htmlFor="comp-creator">Created By</label>
                <input
                  id="comp-creator"
                  className="pondinput"
                  type="text"
                  value={draft.creator}
                  onChange={(e) => setDraft({ ...draft, creator: e.target.value })}
                  placeholder="Creator"
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="comp-version">Character Version</label>
                <input
                  id="comp-version"
                  className="pondinput"
                  type="text"
                  value={draft.characterVersion}
                  onChange={(e) => setDraft({ ...draft, characterVersion: e.target.value })}
                  placeholder="Version"
                />
              </div>
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="comp-notes">Creator's Notes</label>
              <textarea
                id="comp-notes"
                className="pondinput pondtextarea"
                rows={4}
                value={draft.creatorNotes}
                onChange={(e) => setDraft({ ...draft, creatorNotes: e.target.value })}
                placeholder="Notes"
              />
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="comp-tags">Tags to Embed</label>
              <input
                id="comp-tags"
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

export function CompanionsSurface({ nav }: CompanionsSurfaceProps) {
  const activeCharacterId = nav.view.kind === "companions" ? nav.view.characterId : null;
  const activeCharacter = activeCharacterId
    ? (nav.characters.find((character) => character.id === activeCharacterId) ?? null)
    : null;
  const isCreating = nav.view.kind === "companions" && nav.view.mode === "new";
  const editingId = activeCharacter?.id ?? null;
  const showEditor = isCreating || activeCharacter !== null;
  const initialDraft = activeCharacter ? draftFromCharacter(activeCharacter) : EMPTY_DRAFT;

  function handleSave(input: CharacterRecordInput) {
    if (editingId) {
      nav.updateCharacter(editingId, input);
      nav.setView({ kind: "companions", characterId: editingId });
      return;
    } else {
      const character = nav.createCharacter(input);
      nav.setView({ kind: "companions", characterId: character.id });
    }
  }

  function handleBack() {
    nav.setView({ kind: "pond" });
  }

  function handleDelete() {
    if (!editingId) return;
    nav.deleteCharacter(editingId);
    nav.setView({ kind: "companions" });
  }

  return (
    <main className="pond catalog-surface">
      {showEditor ? (
        <CompanionEditor
          key={editingId ?? "new-companion"}
          editingId={editingId}
          initialDraft={initialDraft}
          lorebooks={nav.lorebooks}
          onBack={handleBack}
          onDelete={editingId ? handleDelete : undefined}
          onSave={handleSave}
        />
      ) : (
        <>
          <CatalogSurfaceBanner icon="⚇" onBack={handleBack} title="Companions" />
          <div className="pond-inner catalog-inner catalog-editor-only">
            <div className="catalog-empty">
              Pick a companion from The Shoal or create a new one.
            </div>
          </div>
        </>
      )}
    </main>
  );
}

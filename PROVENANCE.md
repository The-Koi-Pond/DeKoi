# Provenance And Licensing

This file is the single authoritative boundary for what may and may not be
carried into DeKoi from the older De-Koi working tree and its upstream. Other
docs point here instead of restating these rules.

## The Actual Boundary

DeKoi is an Apache-2.0, from-scratch project. The older dashed De-Koi line is
fork-derived from the AGPLv3 Marinara Engine. The line that matters is
licensing and provenance:

- Apache-2.0 DeKoi must not include AGPLv3-derived material.
- DeKoi's product identity — nouns, UI voice, layouts, prompts, schemas — is
  written clean-room from DeKoi-owned requirements.

"DeKoi vs De-Koi" is shorthand for that boundary, not the rule itself. The
dash is a label; the license and the authorship are the point.

## Porting Rules

| Source material                                                                                                        | Port to DeKoi?                                    | Why                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marinara-derived / AGPLv3 code, assets, prompts, schemas, UI text, component layouts, generated bindings, docs wording | No                                                | AGPLv3 copyleft, and not this team's IP.                                                                                                             |
| Architecture shape: ownership lanes, dependency direction, command registries, file-splitting discipline               | Yes, rewritten in DeKoi terms                     | Project-agnostic MuniMuni-authored engineering guidance, already attributed in `skills/dekoi-architecture-guard` and `skills/dekoi-mode-separation`. |
| Workflow discipline: proof, bugfix/review/PR lanes, risky-work gates                                                   | Yes                                               | Xel/Chai-authored; carried as `.github/agents/dekoi-workflow.md`.                                                                                    |
| Original code this team wrote in the De-Koi tree                                                                       | Yes, with the author's permission and attribution | Team-owned original work, not Marinara-derived.                                                                                                      |
| Legacy record names (`conversation`, `game state`, `chat mode`, tracker labels) as native DeKoi concepts               | No                                                | Product-language rule, not a licensing rule: DeKoi uses its own nouns. See [DOMAIN_MODEL.md](./DOMAIN_MODEL.md).                                     |

Generic AI-character-chat ecosystem terms such as `persona`, `lorebook`,
`character card`, and `preset` are shared vocabulary, not prior-project product
language. They are fine.

## Interoperable Exchange Formats

The one-way legacy-import rule does not prohibit portable file-format
compatibility. Prompt preset packages are an interoperability boundary, not a
legacy application record model.

- DeKoi may import and export prompt preset packages that use established
  ecosystem field names and package mechanics when those details are necessary
  for compatibility.
- Compatibility adapters are written clean-room from DeKoi requirements,
  approved team-owned fixtures, and independently documented file behavior.
- Portable package envelopes stop at the import/export boundary. DeKoi storage,
  engine records, UI state, and generation continue to use DeKoi-native
  `PromptPresetRecord` data.
- Format compatibility does not permit copying third-party implementation code,
  UI layouts, documentation wording, or prompt content.
- Team-authored prompt packages from the old De-Koi tree may be retained intact
  with attribution when the maintainer has approved them as DeKoi source
  material.
- The bundled Universal V2 starter package is derived from Chai-authored,
  team-owned prompt material by deleting the abandoned `visibilityRule`
  metadata and applying the DeKoi-owned outbound parameter-contract
  transformation described below. Prompt prose and choice text are unchanged.

### Universal V2 provenance review

This checked-in record is the reviewable primary-attestation evidence for the
package. It preserves who made and received the attestation, its exact claim,
its complete scope, and the immutable artifact it covers; maintainer approval
is recorded separately and is not used as evidence of authorship.

| Evidence field              | Recorded evidence                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence type               | Primary author attestation supplied with the source package                                                                                                                                                                                                                                                             |
| Attestor                    | Chai, the package author                                                                                                                                                                                                                                                                                                |
| Recipient and custodian     | The De-Koi team; retained by DeKoi maintainer Xel with the approved team-owned source material                                                                                                                                                                                                                          |
| Attested claim              | Chai independently authored all prompt prose, choice text, package structure, and metadata enumerated below for the team; no Marinara prompt text or structure was copied, adapted, or translated                                                                                                                       |
| Authorship artifact covered | Git blob `74eb456624f1a2bc56b9e860e3ca68889765d8f3`, 40,225 bytes, SHA-256 `975ec5eb2f4fa1043e5b9683db366068278c15ef556734eb240a61f9cf4591ab`                                                                                                                                                                           |
| Checked-in derived artifact | Git blob `683174d2a66dd2067895ed49c1d2014768e243a4`, 39,410 bytes, SHA-256 `e1c94f96550fca3073563cff3b099a0db4229aa3ac06080cc46c1bad2a2f1b98`                                                                                                                                                                           |
| Transformation              | Delete `data.choiceBlocks[2].visibilityRule`; wrap the ten outbound parameter values in DeKoi's `{ send, value }` contract, with the three previously consumed fields enabled and the others disabled; normalize `reasoningEffort` from `maximum` to the native `max` enum. Prompt prose and choice text are unchanged. |
| Scope evidence              | The complete source-level inventory below; every prompt section, choice block, Messenger field, and metadata surface is accounted for                                                                                                                                                                                   |
| Permission evidence         | Xel's maintainer approval to retain and distribute both the attested source and the derived artifact in DeKoi                                                                                                                                                                                                           |

Reviewers can reproduce the evidence check without trusting a package label:

1. Hash `src/engine/prompt-presets/DeKoiUniversalPreset.json` and verify its
   derived-artifact byte count, Git blob, and SHA-256 above.
2. Remove `data.choiceBlocks[2].visibilityRule` from the attested artifact,
   apply only the parameter-contract transformation described above, and verify
   that the resulting JSON equals the checked-in artifact.
3. Compare every source package surface with the complete attestation inventory
   below; no unlisted prompt or metadata surface may inherit this attestation.
4. Run `pnpm check:storage-contracts`, which rejects an artifact that differs
   from the reviewed bytes.

The two source statements recorded by the custodian are:

- Chai supplied the Universal V2 source package to the De-Koi team with the
  source-level attestation that Chai independently authored its prompt prose,
  choice text, package structure, and metadata for the team. Chai's attestation
  explicitly covers the complete inventory below and states that no Marinara
  prompt text or structure was copied, adapted, or translated. The description's
  "audit of Marinara's Universal Preset" identifies the behavioral benchmark;
  it does not identify a source for any package content.
- The DeKoi maintainer, acting for the team that owns that authored material,
  separately approved its retention and distribution in this repository. That
  permission covers the package content, not merely its compatibility envelope
  or metadata.

Chai's authorship statement applies specifically to the 40,225-byte Git blob
`74eb456624f1a2bc56b9e860e3ca68889765d8f3`, whose SHA-256 is
`975ec5eb2f4fa1043e5b9683db366068278c15ef556734eb240a61f9cf4591ab`.
Xel separately approved retaining and distributing the 39,410-byte derived
artifact after verifying the abandoned `visibilityRule` deletion and the
DeKoi-owned parameter-contract transformation recorded above. Neither
transformation adds or alters prompt prose or choice text; they do change
metadata and outbound parameter representation exactly as recorded above. This
approval does not claim that Chai attested the derived blob. The integrity check
prevents the reviewed derived artifact or this provenance record from being
silently reused for different prompt content.

Chai's source attestation covers all 14 prompt sections (role, five
context/marker rows, context contract, world autonomy, agency boundaries,
erotic tone, style, pacing, examples, history, and output), the context group,
all 11 choice blocks and their options, default selections, the source
artifact's one visibility rule, generation parameters, Messenger prompt, and
package metadata. The derived artifact retains the authored prompt and choice
content, deletes that visibility rule, and transforms the outbound parameter
representation as recorded above. The compatibility envelope is retained only
as an import fixture; DeKoi normalizes it into a native editable record before
storage or generation.

The following source-level inventory is the scope of Chai's authorship
attestation and the team's retention permission. In every row, "Chai-authored"
means independently authored by Chai for the De-Koi team; it does not mean
copied, adapted, or translated from Marinara.

| Package material               | Chai-authored source covered by the authorship attestation and team permission                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `section_v2_role`              | Role and mode prompt prose                                                                                                                                |
| `section_v2_lorebook`          | Setting marker definition and metadata                                                                                                                    |
| `section_v2_character`         | Character marker definition and metadata                                                                                                                  |
| `section_v2_persona`           | Persona marker definition and metadata                                                                                                                    |
| `section_v2_summary`           | Chat-summary marker definition and metadata                                                                                                               |
| `section_v2_context_contract`  | Context-contract prompt prose                                                                                                                             |
| `section_v2_world_autonomy`    | World-autonomy prompt prose                                                                                                                               |
| `section_v2_agency_boundaries` | Agency and boundary prompt prose                                                                                                                          |
| `section_v2_erotic_tone`       | Conditional erotic-tone prompt prose                                                                                                                      |
| `section_v2_style`             | Style prompt prose                                                                                                                                        |
| `section_v2_pacing`            | Pacing prompt prose                                                                                                                                       |
| `section_v2_examples`          | Dialogue-examples marker definition and metadata                                                                                                          |
| `section_v2_history`           | Chat-history marker definition and metadata                                                                                                               |
| `section_v2_output`            | Output-contract prompt prose                                                                                                                              |
| `choice_v2_mode`               | Question, option labels, values, descriptions, and IDs                                                                                                    |
| `choice_v2_content_boundary`   | Question, option labels, values, descriptions, and IDs                                                                                                    |
| `choice_v2_erotic_tone`        | Question, option labels, values, descriptions, IDs, and the source-only visibility rule deleted from the derived artifact                                 |
| `choice_v2_agency`             | Question, option labels, values, descriptions, and IDs                                                                                                    |
| `choice_v2_pacing`             | Question, option labels, values, descriptions, and IDs                                                                                                    |
| `choice_v2_style`              | Question, option labels, values, descriptions, and IDs                                                                                                    |
| `choice_v2_narration`          | Question, option labels, values, descriptions, and IDs                                                                                                    |
| `choice_v2_pov`                | Question, option labels, values, descriptions, and IDs                                                                                                    |
| `choice_v2_tense`              | Question, option labels, values, descriptions, and IDs                                                                                                    |
| `choice_v2_length`             | Question, option labels, values, descriptions, and IDs                                                                                                    |
| `choice_v2_language`           | Question, option labels, values, and IDs                                                                                                                  |
| Remaining package surfaces     | Preset and context-group structure, ordering, defaults, parameters, Messenger prompt, timestamps, names, description, and compatibility-envelope metadata |

The audit mentioned in the package description was a behavioral comparison:
Chai identified behaviors to improve, then wrote the listed material
independently. No Marinara prompt wording or prompt structure is retained. This
inventory is the source-by-source independent-authorship review for the exact
source artifact locked below; a different artifact does not inherit Chai's
attestation.

The authorship-attested source artifact is exactly 40,225 bytes with SHA-256
`975ec5eb2f4fa1043e5b9683db366068278c15ef556734eb240a61f9cf4591ab`.
The maintainer-approved derived artifact is exactly 39,410 bytes with SHA-256
`e1c94f96550fca3073563cff3b099a0db4229aa3ac06080cc46c1bad2a2f1b98`.
`pnpm check:storage-contracts` guards the derived identity so prompt or metadata
changes require a new maintainer provenance review rather than silently
inheriting this approval.

This distinction lets DeKoi-built presets round-trip through compatible tools
without turning another application's internal schema or implementation into
DeKoi's product model.

## The Practical Test

Before bringing something over, answer two questions:

1. Who authored it? Team-authored work and project-agnostic engineering
   knowledge are portable with attribution. Marinara-derived material is not
   portable at all.
2. Is it product identity? Nouns, UI copy, prompts, layouts, and schemas are
   written fresh from a DeKoi requirement even when the underlying idea is
   portable.

When in doubt, write the DeKoi requirement first and implement from that.

## Legacy Compatibility

Compatibility is one-way import, built after DeKoi has native records:

```text
legacy source record -> DeKoi native record
```

Import adapters may understand old source shapes. Engine records, collection
names, UI labels, prompts, and provider requests stay DeKoi-native.

## Attribution

- Ported engineering knowledge names its origin where it lands, the way
  `skills/dekoi-architecture-guard/SKILL.md` and
  `.github/agents/dekoi-workflow.md` already do.
- Third-party code or assets need a compatible license and clear provenance;
  see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

DeKoi is licensed under the [Apache License 2.0](./LICENSE). That license
applies to this repository only; it does not change the license of the older
De-Koi line or Marinara Engine.

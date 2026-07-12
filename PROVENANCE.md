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
- The bundled Universal V2 starter package is Chai-authored, team-owned prompt
  material retained intact at `src/engine/prompt-presets/DeKoiUniversalPreset.json`.

### Universal V2 provenance review

This record preserves two distinct pieces of source evidence rather than using
maintainer approval as evidence of authorship:

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

Both statements apply specifically to the 40,225-byte Git blob
`74eb456624f1a2bc56b9e860e3ca68889765d8f3`, whose SHA-256 is
`975ec5eb2f4fa1043e5b9683db366068278c15ef556734eb240a61f9cf4591ab`.
The integrity check prevents either the reviewed source or this provenance
record from being silently reused for different prompt content.

This approval covers all 14 prompt sections (role, five context/marker rows,
context contract, world autonomy, agency boundaries, erotic tone, style,
pacing, examples, history, and output), the context group, all 11 choice
blocks and their options, default and visibility selections, generation
parameters, Messenger prompt, and package metadata. The compatibility envelope
is retained only as an import fixture; DeKoi normalizes it into a native editable
record before storage or generation.

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
| `choice_v2_erotic_tone`        | Question, option labels, values, descriptions, IDs, and visibility rule                                                                                   |
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
artifact locked below; a different artifact is not covered by this approval.

The approved artifact is exactly 40,225 bytes with SHA-256
`975ec5eb2f4fa1043e5b9683db366068278c15ef556734eb240a61f9cf4591ab`.
`pnpm check:storage-contracts` guards that identity so prompt or metadata changes
require a new maintainer provenance review rather than silently inheriting this
approval.

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

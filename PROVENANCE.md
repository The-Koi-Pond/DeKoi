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

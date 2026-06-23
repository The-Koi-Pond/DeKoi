# Clean-Room Boundary

DeKoi is being restarted as its own codebase.

## Hard Boundary

Do not copy from the prior fork-derived repository:

- source code
- assets
- documentation wording
- prompts
- UI text
- storage schemas
- component layouts
- generated bindings
- config files beyond generic tool defaults

## Allowed Inputs

These are acceptable starting inputs:

- DeKoi product goals written in fresh language.
- General engineering knowledge.
- Public framework documentation.
- Original code written directly for this repository.
- User-owned requirements and decisions.
- Compatibility notes expressed as behavior, not copied implementation.

## Legacy Compatibility

Legacy compatibility should be one-way import work after DeKoi has native models.

The importer should:

- document the old file shape in neutral terms
- map old records into DeKoi-owned types
- keep legacy names out of DeKoi's core domain model
- include narrow tests using minimal synthetic fixtures

## Contribution Note

Before adding substantial code, write down the DeKoi requirement first. The
requirement should explain what the app needs without referencing how the old
project implemented it.

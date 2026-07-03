# Naming Decisions Log

Working notes behind the labels in [DOMAIN_MODEL.md](../DOMAIN_MODEL.md).
Nothing here is canonical. Test candidates in real UI before locking them into
storage schemas or public navigation, then record the decision in the domain
model's surface map.

## Koi-Theme Candidate Pool

| Surface               | Strong candidate | Softer/clearer alternate | Notes                                                                                 |
| --------------------- | ---------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| Saved thread home     | Pond             | Threads                  | `Pond` fits the app identity, but `Threads` is clearer if navigation feels vague.     |
| Character library     | Companions       | Shoal                    | `Companions` is warm and clear; `Shoal` remains a thematic alternate.                 |
| User identities       | Personas         | Reflections              | `Personas` is established ecosystem language; `Reflections` is a thematic alternate.  |
| Knowledge/lore        | Lorebooks        | Depth Notes              | `Lorebooks` is established ecosystem language; `Depth Notes` is a thematic alternate. |
| Prompt presets        | Currents         | Recipes                  | `Currents` suggests response flow; `Recipes` is clearer.                              |
| Dynamic thread state  | Ripples          | State                    | `Ripples` fits changing conditions without saying `game state`.                       |
| Tracker sidebar panel | Ripple Dock      | Ripple Panel             | `Ripple Dock` sounds like a side surface without copying `Tracker Sidebar Panel`.     |
| Automations           | Keepers          | Helpers                  | `Keepers` fits care/maintenance; `Helpers` is plain.                                  |
| Provider connections  | Inlets           | Connections              | `Inlets` suggests outside model input; `Connections` is clearer.                      |
| Media/assets          | Net              | Media                    | `Net` is short and thematic, but may read as internet/network.                        |

## Alternates Considered

DM-style chat: **Messenger** won.

- `Pings`: clear DM meaning, but weaker DeKoi identity.
- `Pondlines`: distinctive, but may be too coined for first-run users.

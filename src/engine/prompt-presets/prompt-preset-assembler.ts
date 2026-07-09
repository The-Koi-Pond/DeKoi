import type {
  PromptPresetGroup,
  PromptPresetRecord,
  PromptPresetSection,
  PromptPresetSectionRole,
} from "../contracts/types/prompt-presets";
import type { ProviderConnectionRecord } from "../contracts/types/provider-connection";
import type { GenerationMacroContext, GenerationPromptMessage } from "../generation/generation";
import { providerHoistsSystemMessages, resolveGenerationMacros } from "../generation/generation";
import {
  promptPresetSectionIsEnabled,
  promptPresetSectionMarkerType,
  promptPresetSectionsInOrder,
  promptPresetSectionUsesDepthInsertion,
} from "./prompt-preset-section-policy";

type PromptPresetWrapFormat = "xml" | "markdown" | "none";

export type PromptPresetMarkerLines = (
  markerType: string,
  section: PromptPresetSection,
) => string[];
export type PromptPresetFallbackSystemPrompt = string | (() => string);
export type PromptPresetTailMessages =
  GenerationPromptMessage[] | (() => GenerationPromptMessage[]);
export type PromptPresetTranscriptMessages = () => GenerationPromptMessage[];

interface PromptPresetMessageElement {
  kind: "message";
  resolveContent: () => string;
  role: GenerationPromptMessage["role"];
}

interface PromptPresetMessagesElement {
  kind: "messages";
  resolveMessages: () => GenerationPromptMessage[];
}

type PromptPresetElement = PromptPresetMessageElement | PromptPresetMessagesElement;

interface PreparedPromptPresetSection {
  id: string;
  groupId: string | null;
  isChatHistory: boolean;
  element: PromptPresetElement;
  role: GenerationPromptMessage["role"];
  depth: number;
}

interface OrderedPromptPresetElements {
  chatHistoryIndex: number | null;
  elements: PromptPresetElement[];
}

function sectionRole(value: PromptPresetSectionRole): GenerationPromptMessage["role"] {
  return value === "assistant" || value === "user" ? value : "system";
}

function normalizeWrapFormat(value: string | null | undefined): PromptPresetWrapFormat {
  return value === "markdown" || value === "none" || value === "xml" ? value : "xml";
}

function nameToXmlTag(name: string) {
  const tagName = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_ -]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return tagName || "section";
}

function nameToMarkdownHeading(name: string) {
  return (
    name
      .replace(/[^a-zA-Z0-9\s_-]/g, "")
      .replace(/\s+/g, " ")
      .trim() || "Section"
  );
}

function indent(text: string, level: number) {
  if (level <= 0) return text;

  const pad = "    ".repeat(level);
  return text
    .split("\n")
    .map((line) => (line.trim() ? `${pad}${line}` : line))
    .join("\n");
}

function wrapContent(
  content: string,
  sectionName: string,
  format: PromptPresetWrapFormat,
  depth = 0,
) {
  const trimmed = content.trim();
  if (!trimmed || format === "none") return trimmed;

  if (format === "xml") {
    const tagName = nameToXmlTag(sectionName);
    return `<${tagName}>\n${indent(trimmed, 1)}\n</${tagName}>`;
  }

  const headingLevel = "#".repeat(Math.min(depth + 2, 6));
  return `${headingLevel} ${nameToMarkdownHeading(sectionName)}\n${trimmed}`;
}

function wrapGroup(content: string, groupName: string, format: PromptPresetWrapFormat) {
  const trimmed = content.trim();
  if (!trimmed || format === "none") return trimmed;

  if (format === "xml") {
    const tagName = nameToXmlTag(groupName);
    return `<${tagName}>\n${indent(trimmed, 1)}\n</${tagName}>`;
  }

  return `# ${nameToMarkdownHeading(groupName)}\n${trimmed}`;
}

function sectionWrapFormat(
  section: PromptPresetSection,
  preset: PromptPresetRecord,
): PromptPresetWrapFormat {
  if (section.wrapInXml === false) return "none";
  if (section.wrapInXml === true) return "xml";
  return normalizeWrapFormat(preset.wrapFormat);
}

function sectionInjectionDepth(section: PromptPresetSection) {
  return section.injectionDepth ?? 0;
}

function providerFacingSectionRole(
  section: PromptPresetSection,
  role: GenerationPromptMessage["role"],
  providerConnection: ProviderConnectionRecord | null | undefined,
  rewriteHoistedSystemRole: boolean,
) {
  if (!rewriteHoistedSystemRole) return role;
  if (!promptPresetSectionUsesDepthInsertion(section)) return role;
  return role === "system" && providerHoistsSystemMessages(providerConnection) ? "user" : role;
}

function messageElement(
  role: GenerationPromptMessage["role"],
  resolveContent: () => string,
): PromptPresetMessageElement {
  return { kind: "message", resolveContent, role };
}

function preparedSectionContent(section: PreparedPromptPresetSection) {
  if (section.element.kind === "message") return section.element.resolveContent();
  return section.element
    .resolveMessages()
    .map((message) => message.content)
    .join("\n\n");
}

function prepareSection({
  macroContext,
  markerLines,
  preset,
  providerConnection,
  rewriteHoistedSystemRole,
  section,
  transcriptMessages,
}: {
  macroContext: GenerationMacroContext;
  markerLines: PromptPresetMarkerLines;
  preset: PromptPresetRecord;
  providerConnection?: ProviderConnectionRecord | null;
  rewriteHoistedSystemRole: boolean;
  section: PromptPresetSection;
  transcriptMessages: PromptPresetTranscriptMessages;
}): PreparedPromptPresetSection {
  const role = providerFacingSectionRole(
    section,
    sectionRole(section.role),
    providerConnection,
    rewriteHoistedSystemRole,
  );
  const type = promptPresetSectionMarkerType(section);

  if (section.isMarker && type === "chat_history") {
    return {
      id: section.id,
      groupId: section.groupId ?? null,
      isChatHistory: true,
      element: {
        kind: "messages",
        resolveMessages: transcriptMessages,
      },
      role,
      depth: sectionInjectionDepth(section),
    };
  }

  const wrapFormat = sectionWrapFormat(section, preset);
  const wrapperName = section.isMarker && type === "chat_summary" ? "Chat Summary" : section.name;
  const sectionName =
    wrapFormat === "xml" && !section.isMarker ? (section.xmlTagName ?? wrapperName) : wrapperName;

  return {
    id: section.id,
    groupId: section.groupId ?? null,
    isChatHistory: false,
    element: messageElement(role, () => {
      const content = section.isMarker
        ? markerLines(type, section).join("\n\n")
        : resolveGenerationMacros(section.content, macroContext);
      return wrapContent(content, sectionName, wrapFormat);
    }),
    role,
    depth: sectionInjectionDepth(section),
  };
}

function buildGroupElements(
  sections: PreparedPromptPresetSection[],
  group: PromptPresetGroup,
  format: PromptPresetWrapFormat,
): PromptPresetElement[] {
  const roles = new Set(sections.map((section) => section.role));

  if (roles.size === 1) {
    const role = sections[0]?.role ?? "system";
    return [
      messageElement(role, () => {
        const innerContent = sections
          .map((section) => preparedSectionContent(section).trim())
          .filter(Boolean)
          .join("\n\n");
        return wrapGroup(innerContent, group.name, format);
      }),
    ];
  }

  const elements: PromptPresetElement[] = [];
  let pendingRole: GenerationPromptMessage["role"] | null = null;
  let pendingSections: PreparedPromptPresetSection[] = [];

  function flushPending() {
    const sectionsForElement = pendingSections;
    if (pendingRole && sectionsForElement.length > 0) {
      const role = pendingRole;
      elements.push(
        messageElement(role, () =>
          sectionsForElement
            .map((section) => preparedSectionContent(section).trim())
            .filter(Boolean)
            .join("\n\n"),
        ),
      );
    }
    pendingRole = null;
    pendingSections = [];
  }

  for (const section of sections) {
    if (section.role !== pendingRole) {
      flushPending();
      pendingRole = section.role;
    }
    pendingSections.push(section);
  }
  flushPending();

  return elements;
}

function buildOrderedElements({
  groupById,
  sections,
  wrapFormat,
}: {
  groupById: Map<string, PromptPresetGroup>;
  sections: PreparedPromptPresetSection[];
  wrapFormat: PromptPresetWrapFormat;
}): OrderedPromptPresetElements {
  const elements: PromptPresetElement[] = [];
  let chatHistoryIndex: number | null = null;
  const processedSectionIds = new Set<string>();

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    if (!section || processedSectionIds.has(section.id)) continue;

    if (section.groupId && !section.isChatHistory) {
      const groupSections: PreparedPromptPresetSection[] = [section];
      processedSectionIds.add(section.id);

      for (let nextIndex = index + 1; nextIndex < sections.length; nextIndex += 1) {
        const next = sections[nextIndex];
        if (!next || next.isChatHistory || next.groupId !== section.groupId) break;
        groupSections.push(next);
        processedSectionIds.add(next.id);
      }

      const group = groupById.get(section.groupId);
      if (group) {
        elements.push(...buildGroupElements(groupSections, group, wrapFormat));
      } else {
        elements.push(...groupSections.map((current) => current.element));
      }
      continue;
    }

    processedSectionIds.add(section.id);
    if (section.isChatHistory && chatHistoryIndex === null) {
      chatHistoryIndex = elements.length;
    }
    elements.push(section.element);
  }

  return { chatHistoryIndex, elements };
}

function mergeAdjacentMessages(messages: GenerationPromptMessage[]) {
  const merged: GenerationPromptMessage[] = [];

  for (const message of messages) {
    const content = message.content.trim();
    if (!content) continue;

    const previous = merged[merged.length - 1];
    if (previous?.role === message.role) {
      previous.content = `${previous.content}\n\n${content}`;
    } else {
      merged.push({ role: message.role, content });
    }
  }

  return merged;
}

function combineMessageElements(elements: PromptPresetMessageElement[]) {
  const role = elements[0]?.role ?? "system";
  return messageElement(role, () =>
    elements
      .map((element) => element.resolveContent().trim())
      .filter(Boolean)
      .join("\n\n"),
  );
}

function mergeAdjacentElements(elements: PromptPresetElement[]) {
  const merged: PromptPresetElement[] = [];

  for (const element of elements) {
    const previous = merged[merged.length - 1];
    if (
      element.kind === "message" &&
      previous?.kind === "message" &&
      previous.role === element.role
    ) {
      merged[merged.length - 1] = combineMessageElements([previous, element]);
    } else {
      merged.push(element);
    }
  }

  return merged;
}

function mergeMessagesElement(element: PromptPresetElement): PromptPresetElement {
  if (element.kind === "message") return element;
  return {
    kind: "messages",
    resolveMessages: () => mergeAdjacentMessages(element.resolveMessages()),
  };
}

function mergeElementsWithinChatHistory({
  chatHistoryIndex,
  elements,
}: OrderedPromptPresetElements): OrderedPromptPresetElements {
  if (chatHistoryIndex === null) {
    return { chatHistoryIndex: null, elements: mergeAdjacentElements(elements) };
  }

  const beforeHistory = mergeAdjacentElements(elements.slice(0, chatHistoryIndex));
  const history = mergeMessagesElement(elements[chatHistoryIndex]!);
  const afterHistory = mergeAdjacentElements(elements.slice(chatHistoryIndex + 1));

  return {
    chatHistoryIndex: beforeHistory.length,
    elements: [...beforeHistory, history, ...afterHistory],
  };
}

function squashLeadingSystemElements(elements: PromptPresetElement[]) {
  let systemEnd = 0;
  while (systemEnd < elements.length) {
    const element = elements[systemEnd];
    if (element?.kind !== "message" || element.role !== "system") break;
    systemEnd += 1;
  }
  if (systemEnd <= 1) return elements;

  const leadingSystemElements = elements.slice(0, systemEnd) as PromptPresetMessageElement[];
  return [combineMessageElements(leadingSystemElements), ...elements.slice(systemEnd)];
}

function squashLeadingSystemElementsWithinChatHistory({
  chatHistoryIndex,
  elements,
}: OrderedPromptPresetElements): OrderedPromptPresetElements {
  if (chatHistoryIndex === null) {
    return {
      chatHistoryIndex: null,
      elements: squashLeadingSystemElements(elements),
    };
  }

  const beforeHistory = squashLeadingSystemElements(elements.slice(0, chatHistoryIndex));
  const history = elements[chatHistoryIndex]!;
  const afterHistory = elements.slice(chatHistoryIndex + 1);

  return {
    chatHistoryIndex: beforeHistory.length,
    elements: [...beforeHistory, history, ...afterHistory],
  };
}

function atDepthInsertionIndex(messageCount: number, depth: number) {
  const safeDepth = Number.isFinite(depth) ? Math.max(0, Math.trunc(depth)) : 0;
  return Math.max(0, Math.min(messageCount, messageCount - safeDepth));
}

function materializeElements(elements: PromptPresetElement[]) {
  return trimMessages(
    elements.flatMap((element) =>
      element.kind === "message"
        ? [{ role: element.role, content: element.resolveContent() }]
        : element.resolveMessages(),
    ),
  );
}

function materialMessageElementCount(elements: PromptPresetElement[]) {
  return elements.filter((element) => element.kind === "message").length;
}

function insertDepthElementsIntoMessages(
  messages: GenerationPromptMessage[],
  sections: PreparedPromptPresetSection[],
) {
  const groupsByIndex = new Map<number, PromptPresetElement[]>();
  for (const section of sections) {
    const insertionIndex = atDepthInsertionIndex(messages.length, section.depth);
    groupsByIndex.set(insertionIndex, [
      ...(groupsByIndex.get(insertionIndex) ?? []),
      section.element,
    ]);
  }

  const result: GenerationPromptMessage[] = [];
  for (let index = 0; index <= messages.length; index += 1) {
    result.push(...materializeElements(groupsByIndex.get(index) ?? []));
    const message = messages[index];
    if (message) result.push(message);
  }

  return result;
}

function injectDepthSections(
  { chatHistoryIndex, elements }: OrderedPromptPresetElements,
  sections: PreparedPromptPresetSection[],
): PromptPresetElement[] {
  if (sections.length === 0) return elements;

  if (chatHistoryIndex !== null) {
    const historyElement = elements[chatHistoryIndex]!;
    return [
      ...elements.slice(0, chatHistoryIndex),
      {
        kind: "messages" as const,
        resolveMessages: () =>
          insertDepthElementsIntoMessages(materializeElements([historyElement]), sections),
      },
      ...elements.slice(chatHistoryIndex + 1),
    ];
  }

  const groupsByIndex = new Map<number, PromptPresetElement[]>();
  const messageCount = materialMessageElementCount(elements);
  for (const section of sections) {
    const insertionIndex = atDepthInsertionIndex(messageCount, section.depth);
    groupsByIndex.set(insertionIndex, [
      ...(groupsByIndex.get(insertionIndex) ?? []),
      section.element,
    ]);
  }

  const result: PromptPresetElement[] = [];
  let messageIndex = 0;
  for (let index = 0; index <= elements.length; index += 1) {
    result.push(...(groupsByIndex.get(messageIndex) ?? []));
    const element = elements[index];
    if (element) {
      result.push(element);
      if (element.kind === "message") messageIndex += 1;
    }
  }

  return result;
}

function enforceStrictRoles(messages: GenerationPromptMessage[]) {
  return mergeAdjacentMessages(messages);
}

function preserveHoistedSystemMessageOrder(
  messages: GenerationPromptMessage[],
  providerConnection: ProviderConnectionRecord | null | undefined,
) {
  if (!providerHoistsSystemMessages(providerConnection)) return messages;

  let sawStreamMessage = false;
  return messages.map((message) => {
    if (message.role !== "system") {
      sawStreamMessage = true;
      return message;
    }

    return sawStreamMessage ? { ...message, role: "user" as const } : message;
  });
}

function collapseToSingleUserMessage(messages: GenerationPromptMessage[]) {
  const content = messages
    .map((message) =>
      message.role === "user"
        ? message.content
        : `[${message.role.toUpperCase()}]\n${message.content}`,
    )
    .join("\n\n")
    .trim();

  return content ? [{ role: "user" as const, content }] : [];
}

function fallbackSystemPromptMessages({
  fallbackSystemPrompt,
  macroContext,
}: {
  fallbackSystemPrompt: PromptPresetFallbackSystemPrompt;
  macroContext: GenerationMacroContext;
}) {
  const systemPrompt =
    typeof fallbackSystemPrompt === "function" ? fallbackSystemPrompt() : fallbackSystemPrompt;

  return [
    {
      role: "system" as const,
      content: resolveGenerationMacros(systemPrompt, macroContext).trim(),
    },
  ].filter((message) => message.content.trim());
}

function fallbackMessages({
  fallbackSystemPrompt,
  macroContext,
  transcriptMessages,
}: {
  fallbackSystemPrompt: PromptPresetFallbackSystemPrompt;
  macroContext: GenerationMacroContext;
  transcriptMessages: PromptPresetTranscriptMessages;
}) {
  return [
    ...fallbackSystemPromptMessages({ fallbackSystemPrompt, macroContext }),
    ...transcriptMessages(),
  ].filter((message) => message.content.trim());
}

function trimMessages(messages: GenerationPromptMessage[]) {
  return messages.flatMap((message) => {
    const content = message.content.trim();
    return content ? [{ ...message, content }] : [];
  });
}

function resolveTailMessages(tailMessages: PromptPresetTailMessages) {
  return trimMessages(typeof tailMessages === "function" ? tailMessages() : tailMessages);
}

/**
 * Converts a normalized prompt preset into provider messages while leaving each
 * mode to supply its transcript, tail prompt, and marker expansions.
 */
export function assemblePromptPresetMessages({
  fallbackSystemPrompt,
  macroContext,
  markerLines,
  preset,
  providerConnection,
  tailMessages = [],
  transcriptMessages,
}: {
  fallbackSystemPrompt: PromptPresetFallbackSystemPrompt;
  macroContext: GenerationMacroContext;
  markerLines: PromptPresetMarkerLines;
  preset: PromptPresetRecord | null;
  providerConnection?: ProviderConnectionRecord | null;
  tailMessages?: PromptPresetTailMessages;
  transcriptMessages: PromptPresetTranscriptMessages;
}): GenerationPromptMessage[] {
  if (!preset?.sections.length) {
    return trimMessages([
      ...fallbackMessages({ fallbackSystemPrompt, macroContext, transcriptMessages }),
      ...resolveTailMessages(tailMessages),
    ]);
  }

  const groupById = new Map(preset.groups.map((group) => [group.id, group]));
  const orderedSections: PreparedPromptPresetSection[] = [];
  const depthSections: PreparedPromptPresetSection[] = [];
  const singleUserMessage = preset.parameters?.singleUserMessage === true;

  for (const section of promptPresetSectionsInOrder(preset.sections, preset.sectionOrder)) {
    if (!promptPresetSectionIsEnabled(section, groupById)) continue;

    const prepared = prepareSection({
      macroContext,
      markerLines,
      preset,
      providerConnection,
      rewriteHoistedSystemRole: !singleUserMessage,
      section,
      transcriptMessages,
    });

    if (
      !prepared.isChatHistory &&
      promptPresetSectionUsesDepthInsertion(section) &&
      sectionInjectionDepth(section) >= 0
    ) {
      depthSections.push(prepared);
    } else {
      orderedSections.push(prepared);
    }
  }

  let orderedElements = buildOrderedElements({
    groupById,
    sections: orderedSections,
    wrapFormat: normalizeWrapFormat(preset.wrapFormat),
  });
  orderedElements = mergeElementsWithinChatHistory(orderedElements);

  if (preset.parameters?.squashSystemMessages) {
    orderedElements = squashLeadingSystemElementsWithinChatHistory(orderedElements);
  }

  let messages = materializeElements(injectDepthSections(orderedElements, depthSections));
  if (!singleUserMessage) {
    messages = preserveHoistedSystemMessageOrder(messages, providerConnection);
  }

  if (preset.parameters?.strictRoleFormatting) {
    messages = enforceStrictRoles(messages);
  }

  messages = trimMessages(messages);
  if (messages.length === 0) {
    messages = fallbackSystemPromptMessages({ fallbackSystemPrompt, macroContext });
  }
  messages = trimMessages([...messages, ...resolveTailMessages(tailMessages)]);

  if (singleUserMessage) {
    messages = collapseToSingleUserMessage(messages);
  }

  return trimMessages(messages);
}

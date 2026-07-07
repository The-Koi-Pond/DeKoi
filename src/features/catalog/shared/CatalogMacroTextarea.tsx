import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
  type TextareaHTMLAttributes,
} from "react";
import {
  SUPPORTED_MACRO_CATEGORIES,
  SUPPORTED_MACROS,
  type SupportedMacro,
  type SupportedMacroCategory,
} from "../../../engine/generation-core/macros/macro-engine";
import {
  insertMacroText,
  resolveCatalogMacroPreview,
  type CatalogMacroPreviewContext,
  type CatalogTextSelectionRange,
} from "./catalogMacroText";

type CatalogMacroTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange" | "value"
> & {
  previewContext?: CatalogMacroPreviewContext | null;
  previewLabel?: string;
  value: string;
  onValueChange: (value: string) => void;
};

const CATEGORY_LABELS: Record<SupportedMacroCategory, string> = SUPPORTED_MACRO_CATEGORIES.reduce(
  (labels, category) => ({
    ...labels,
    [category.id]: category.label,
  }),
  {} as Record<SupportedMacroCategory, string>,
);

interface TextSelectionSnapshot extends CatalogTextSelectionRange {
  value: string;
}

function macroMatchesQuery(macro: SupportedMacro, query: string) {
  if (!query) return true;

  return [macro.syntax, macro.insertText, macro.description, CATEGORY_LABELS[macro.category]].some(
    (value) => value.toLowerCase().includes(query),
  );
}

function groupedMacros(query: string) {
  const filtered = SUPPORTED_MACROS.filter((macro) => macroMatchesQuery(macro, query));

  return SUPPORTED_MACRO_CATEGORIES.map((category) => ({
    ...category,
    macros: filtered.filter((macro) => macro.category === category.id),
  })).filter((category) => category.macros.length > 0);
}

export function CatalogMacroTextarea({
  "aria-describedby": ariaDescribedBy,
  id,
  onBlur,
  onClick,
  onFocus,
  onKeyUp,
  onSelect,
  previewContext = null,
  previewLabel = "Preview",
  onValueChange,
  value,
  ...textareaProps
}: CatalogMacroTextareaProps) {
  const [browserOpen, setBrowserOpen] = useState(false);
  const [textFocused, setTextFocused] = useState(Boolean(textareaProps.autoFocus));
  const [query, setQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastSelectionRef = useRef<TextSelectionSnapshot | null>(null);
  const browserId = `${id ?? "catalog"}-macro-browser`;
  const previewId = `${id ?? "catalog"}-macro-preview`;
  const groups = useMemo(() => groupedMacros(query.trim().toLowerCase()), [query]);
  const previewEnabled = previewContext !== null && (textFocused || browserOpen);
  const preview = useMemo(
    () =>
      previewEnabled && previewContext ? resolveCatalogMacroPreview(value, previewContext) : null,
    [previewContext, previewEnabled, value],
  );
  const textareaAriaDescribedBy =
    [ariaDescribedBy, preview !== null ? previewId : null].filter(Boolean).join(" ") || undefined;

  function rememberSelection(textarea: HTMLTextAreaElement) {
    lastSelectionRef.current = {
      end: textarea.selectionEnd,
      start: textarea.selectionStart,
      value: textarea.value,
    };
  }

  function currentSelection() {
    const selection = lastSelectionRef.current;
    return selection?.value === value ? selection : null;
  }

  function handleTextChange(event: ChangeEvent<HTMLTextAreaElement>) {
    rememberSelection(event.currentTarget);
    onValueChange(event.currentTarget.value);
  }

  function handleTextBlur(event: FocusEvent<HTMLTextAreaElement>) {
    rememberSelection(event.currentTarget);
    setTextFocused(false);
    onBlur?.(event);
  }

  function handleTextClick(event: MouseEvent<HTMLTextAreaElement>) {
    rememberSelection(event.currentTarget);
    onClick?.(event);
  }

  function handleTextFocus(event: FocusEvent<HTMLTextAreaElement>) {
    rememberSelection(event.currentTarget);
    setTextFocused(true);
    onFocus?.(event);
  }

  function handleTextKeyUp(event: KeyboardEvent<HTMLTextAreaElement>) {
    rememberSelection(event.currentTarget);
    onKeyUp?.(event);
  }

  function handleTextSelect(event: SyntheticEvent<HTMLTextAreaElement>) {
    rememberSelection(event.currentTarget);
    onSelect?.(event);
  }

  function insertMacro(macro: SupportedMacro) {
    const textarea = textareaRef.current;
    const { nextCaret, nextValue } = insertMacroText(value, macro.insertText, currentSelection());

    lastSelectionRef.current = {
      end: nextCaret,
      start: nextCaret,
      value: nextValue,
    };

    onValueChange(nextValue);
    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  return (
    <div className="catalog-macro-textarea">
      <div className="catalog-macro-toolbar">
        <button
          type="button"
          className="catalog-macro-toggle"
          aria-expanded={browserOpen}
          aria-controls={browserId}
          onClick={() => setBrowserOpen((open) => !open)}
        >
          Macros
        </button>
      </div>
      {browserOpen && (
        <div className="catalog-macro-browser" id={browserId}>
          <input
            className="pondinput catalog-macro-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search macros"
            aria-label="Search supported macros"
          />
          <div className="catalog-macro-groups">
            {groups.map((group) => (
              <section className="catalog-macro-group" key={group.id}>
                <h5>{group.label}</h5>
                <div className="catalog-macro-list">
                  {group.macros.map((macro) => (
                    <button
                      type="button"
                      className="catalog-macro-option"
                      key={macro.id}
                      onClick={() => insertMacro(macro)}
                      title={`Insert ${macro.syntax}`}
                    >
                      <code>{macro.syntax}</code>
                      <span>{macro.description}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {groups.length === 0 && <p className="catalog-macro-empty">No matching macros.</p>}
          </div>
        </div>
      )}
      <textarea
        {...textareaProps}
        aria-describedby={textareaAriaDescribedBy}
        id={id}
        ref={textareaRef}
        value={value}
        onBlur={handleTextBlur}
        onChange={handleTextChange}
        onClick={handleTextClick}
        onFocus={handleTextFocus}
        onKeyUp={handleTextKeyUp}
        onSelect={handleTextSelect}
      />
      {preview !== null && (
        <div className="catalog-macro-preview" id={previewId}>
          <span className="catalog-macro-preview-label">{previewLabel}</span>
          <output className="catalog-macro-preview-output">
            {preview.trim() ? preview : "Empty result"}
          </output>
        </div>
      )}
    </div>
  );
}

export function GeneralSettingsTab() {
  return (
    <>
      <p className="care-intro">Language and regional preferences for the whole pond.</p>

      <div className="field">
        <label htmlFor="care-language">Language</label>
        <select className="pondsel" id="care-language">
          <option>English</option>
        </select>
        <div className="help">
          English is the only bundled language for now. New languages will surface here as they're
          stocked — without disturbing your layout.
        </div>
      </div>
    </>
  );
}

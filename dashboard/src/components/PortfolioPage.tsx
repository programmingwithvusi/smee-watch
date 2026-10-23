import { useState, type FormEvent } from "react";
import type { PortfolioState } from "../hooks/usePortfolio";
import { PortfolioPanel } from "./PortfolioPanel";

interface Props {
  portfolio: PortfolioState;
  /** The access code in use, or null if none has been entered on this device */
  code: string | null;
  onUnlock: (code: string) => void;
  onLock: () => void;
}

/** The private page: Luno and EasyEquities holdings, behind an access code kept only in this browser. */
export function PortfolioPage({ portfolio, code, onUnlock, onLock }: Props) {
  const [draft, setDraft] = useState("");
  const showForm = !code || portfolio.locked;

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const value = draft.trim();
    if (value) onUnlock(value);
    setDraft("");
  };

  return (
    <div className="page">
      <header className="bar">
        <h1 className="bar__title">Portfolio</h1>
        <div className="bar__actions">
          <a className="btn" href="#/">Watch lists</a>
          {code && !portfolio.locked && (
            <>
              <button type="button" className="btn" onClick={portfolio.refresh} disabled={portfolio.loading}>
                {portfolio.loading ? "Refreshing" : "Refresh"}
              </button>
              <button type="button" className="btn" onClick={onLock}>Lock</button>
            </>
          )}
        </div>
      </header>

      {showForm ? (
        <form className="unlock" onSubmit={submit}>
          <p className="col__role">Your holdings are private. Enter your access code to view them on this device.</p>
          {code && portfolio.error && <p className="notice" role="alert">{portfolio.error}</p>}
          <label className="unlock__field">
            <span>Access code</span>
            <input
              type="password"
              autoComplete="current-password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn">Unlock</button>
        </form>
      ) : (
        <PortfolioPanel data={portfolio.data} error={portfolio.error} loading={portfolio.loading} />
      )}
    </div>
  );
}

import type { Meta, Mode, Params } from "../types";

interface Props {
  meta: Meta;
  params: Params;
  onChange: (next: Params) => void;
}

const GATES = ["09:00", "10:00", "11:00", "12:00", "14:00"];

export function Controls({ meta, params, onChange }: Props) {
  const set = <K extends keyof Params>(key: K, value: Params[K]) => onChange({ ...params, [key]: value });

  return (
    <section className="controls" aria-label="Analysis settings">
      <div className="control">
        <label htmlFor="start">Delivery from</label>
        <input
          id="start"
          type="date"
          min={meta.scope.start}
          max={params.end}
          value={params.start}
          onChange={(e) => e.target.value && set("start", e.target.value)}
        />
      </div>
      <div className="control">
        <label htmlFor="end">to</label>
        <input
          id="end"
          type="date"
          min={params.start}
          max={meta.scope.end}
          value={params.end}
          onChange={(e) => e.target.value && set("end", e.target.value)}
        />
      </div>

      <div className="control">
        <span className="label" id="mode-label">
          Forecast available at
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="mode-label">
          {(
            [
              ["day_ahead", "Day-ahead gate"],
              ["horizon", "Fixed lead time"],
            ] as [Mode, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={params.mode === value}
              className={params.mode === value ? "active" : ""}
              onClick={() => set("mode", value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {params.mode === "day_ahead" ? (
        <div className="control">
          <label htmlFor="gate">Gate closure (UK, day before)</label>
          <select id="gate" value={params.gate} onChange={(e) => set("gate", e.target.value)}>
            {GATES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="control grow">
          <label htmlFor="horizon">
            Lead time: <strong>{params.horizon} h</strong> before delivery
          </label>
          <input
            id="horizon"
            type="range"
            min={0}
            max={meta.max_horizon_hours}
            step={1}
            value={params.horizon}
            onChange={(e) => set("horizon", Number(e.target.value))}
          />
        </div>
      )}
    </section>
  );
}

import { useEffect, useId, useRef, useState } from "react";
import type { LocationSample } from "../location/types";
import {
  coordinatePlace,
  geocodeAddress,
  savedPlaces,
  searchLocalPlaces,
  type Place,
} from "../location/geocode";

export function WorkplaceSearch({
  sample,
  onChoose,
  compact = false,
  online: onlinePreference = true,
  label = "Search your workplace address",
  placeholder,
  showHistory = true,
  selectionMessage = "Address saved. It will be your default on your next visit.",
}: {
  sample: LocationSample | null;
  onChoose: (place: Place) => void;
  compact?: boolean;
  online?: boolean;
  label?: string;
  placeholder?: string;
  showHistory?: boolean;
  selectionMessage?: string;
}) {
  const id = useId(),
    inputId = `address-${id}`,
    resultsId = `results-${id}`;
  const [query, setQuery] = useState("");
  const [online, setOnline] = useState(onlinePreference),
    [results, setResults] = useState<Place[]>(() =>
      showHistory ? savedPlaces().slice(0, 8) : [],
    );
  const [searching, setSearching] = useState(false),
    [message, setMessage] = useState("");
  const [active, setActive] = useState(-1),
    [open, setOpen] = useState(false),
    [composing, setComposing] = useState(false);
  const request = useRef<AbortController | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(query);
  useEffect(() => setOnline(onlinePreference), [onlinePreference]);
  latest.current = query;
  const cancel = () => {
    request.current?.abort();
    request.current = null;
    if (timer.current) clearTimeout(timer.current);
    setSearching(false);
    setActive(-1);
  };
  const search = async (text: string) => {
    cancel();
    const q = text.trim();
    setMessage("");
    setOpen(true);
    let local: Place[];
    try {
      local = showHistory
        ? searchLocalPlaces(q)
        : coordinatePlace(q)
          ? [coordinatePlace(q)!]
          : [];
    } catch (error) {
      setResults([]);
      setMessage((error as Error).message);
      return;
    }
    setResults(local);
    if (!q) {
      setResults(showHistory ? savedPlaces().slice(0, 8) : []);
      return;
    }
    if (!online || coordinatePlace(q)) {
      setMessage(
        local.length
          ? "Choose a saved address or coordinate below."
          : "No saved match. Go online to search new addresses.",
      );
      return;
    }
    if (q.length < 2) return;
    const controller = new AbortController();
    request.current = controller;
    setSearching(true);
    try {
      const remote = await geocodeAddress(q, controller.signal);
      if (request.current !== controller || latest.current !== text) return;
      const merged = [...local, ...remote]
        .filter(
          (p, i, list) =>
            list.findIndex((x) => x.lat === p.lat && x.lng === p.lng) === i,
        )
        .slice(0, 8);
      setResults(merged);
      setActive(-1);
      setMessage(
        merged.length
          ? "Choose an address to set your workplace."
          : "No mapped address found. Add a city or street, shorten the name, or pick a point on the map.",
      );
    } catch {
      if (request.current !== controller) return;
      setMessage(
        "Address search is unavailable. Saved addresses still work; try again or pick on the map.",
      );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setSearching(false);
      }
    }
  };
  const choose = (place: Place) => {
    cancel();
    setOpen(false);
    setQuery("");
    setResults([]);
    onChoose({ ...place, searchText: query.trim() || place.searchText });
    setMessage(selectionMessage);
  };
  useEffect(() => {
    cancel();
    if (composing) return;
    if (!query.trim()) {
      setResults(showHistory ? savedPlaces().slice(0, 8) : []);
      if (open) setMessage("");
      return;
    }
    timer.current = setTimeout(() => void search(query), 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      request.current?.abort();
    };
  }, [query, online, composing]);
  useEffect(
    () => () => {
      request.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="workplace-search">
      <label className={compact ? "sr-only" : "search-label"} htmlFor={inputId}>
        {label}
      </label>
      <form
        className="address-search"
        onSubmit={(event) => {
          event.preventDefault();
          if (composing) return;
          if (active >= 0 && results[active]) choose(results[active]);
          else void search(query);
        }}
      >
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          aria-controls={resultsId}
          aria-activedescendant={
            active >= 0 ? `${resultsId}-${active}` : undefined
          }
          placeholder={
            placeholder ||
            (showHistory ? savedPlaces()[0]?.name.split(", ")[0] : "") ||
            "Search a building, street or address"
          }
          value={query}
          autoComplete="off"
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          onChange={(event) => {
            cancel();
            setQuery(event.target.value);
            setOpen(true);
            setResults([]);
            setMessage("");
          }}
          onFocus={() => {
            setOpen(true);
            if (!query.trim())
              setResults(showHistory ? savedPlaces().slice(0, 8) : []);
          }}
          onBlur={(event) => {
            if (
              !event.currentTarget
                .closest(".workplace-search")
                ?.contains(event.relatedTarget as Node)
            ) {
              cancel();
              setOpen(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, results.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            }
            if (event.key === "Escape") {
              cancel();
              setOpen(false);
            }
            if (event.key === "Enter" && active >= 0 && results[active]) {
              event.preventDefault();
              choose(results[active]);
            }
          }}
          aria-describedby={`${id}-help ${id}-message`}
        />
        <button type="submit" disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </button>
      </form>
      {open && results.length > 0 && (
        <ul
          id={resultsId}
          className="results suggestions"
          role="listbox"
          aria-label={query.trim() ? "Address suggestions" : "Recent addresses"}
        >
          {!query.trim() && (
            <li className="history-label" role="presentation">
              Recent addresses
            </li>
          )}
          {results.map((place, i) => (
            <li
              id={`${resultsId}-${i}`}
              key={`${place.lat},${place.lng}`}
              role="option"
              aria-selected={active === i}
              onMouseEnter={() => setActive(i)}
            >
              <button type="button" onClick={() => choose(place)} tabIndex={-1}>
                <span>{place.name.split(", ")[0]}</span>
                <small>
                  {place.name.includes(", ")
                    ? place.name.split(", ").slice(1).join(", ")
                    : `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="note" id={`${id}-message`} role="status" aria-live="polite">
        {searching
          ? "Looking for matching addresses…"
          : compact && results.length
            ? ""
            : message ||
              (!query.trim() && !results.length
                ? compact
                  ? ""
                  : "Search and choose your first workplace. No preset addresses."
                : "")}
      </p>
      {!compact && (
        <>
          <label className="online-toggle">
            <input
              type="checkbox"
              checked={online}
              onChange={(event) => {
                cancel();
                setOnline(event.target.checked);
              }}
            />
            Online address search
          </label>
          <p className="note" id={`${id}-help`}>
            Suggestions use OpenStreetMap data. Only addresses you choose enter
            your history.
          </p>
          <button
            type="button"
            disabled={!sample || sample.source === "simulation"}
            onClick={() => {
              if (sample)
                choose({
                  name: "My current location",
                  lat: sample.latitude,
                  lng: sample.longitude,
                });
            }}
          >
            Use current location as workplace
          </button>
        </>
      )}
    </div>
  );
}

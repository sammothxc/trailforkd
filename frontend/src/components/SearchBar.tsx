import { useState } from "react";

export type SearchResult = {
  lat: number;
  lon: number;
  display_name: string;
};

export type SearchBarProps = {
  onSelect: (lat: number, lon: number, label: string) => void;
};

export default function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) {
      return;
    }

    setStatus("Searching...");

    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "json");
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "1");

      const res = await fetch(url.toString(), {
        headers: {
          "Accept": "application/json",
          "User-Agent": "trailforkd/1.0 (https://github.com)"
        },
      });

      const data: SearchResult[] = await res.json();
      if (!data || data.length === 0) {
        setStatus("No results found.");
        return;
      }

      const result = data[0];
      setStatus(null);
      onSelect(parseFloat(result.lat), parseFloat(result.lon), result.display_name);
    } catch (error) {
      console.error(error);
      setStatus("Search failed");
    }
  };

  return (
    <div className="searchBar">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search city, state, zip..."
        onKeyDown={(e) => {
          if (e.key === "Enter") search();
        }}
      />
      <button onClick={search}>Go</button>
      {status ? <span className="searchStatus">{status}</span> : null}
    </div>
  );
}

"use client";
import React, { useState, useEffect } from 'react';
import { Search, MapPin } from 'lucide-react';

export default function GlobalCitySearch({ onSelectCity }: { onSelectCity: (city: { name: string, lat: number, lng: number, country: string }) => void }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Debounce logic: Wait 300ms after the user stops typing
    const delayDebounceFn = setTimeout(() => {
      if (query.length > 2) {
        fetchSuggestions();
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=en&format=json`
      );
      const data = await res.json();
      setSuggestions(data.results || []);
    } catch (error) {
      console.error("Geocoding failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        <input
          type="text"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search any city on Earth..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {suggestions.map((city: any) => (
            <button
              key={`${city.id}-${city.name}`}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700 transition-colors text-left"
              onClick={() => {
                onSelectCity({
                  name: city.name,
                  lat: city.latitude,
                  lng: city.longitude,
                  country: city.country
                });
                setQuery(`${city.name}, ${city.country}`);
                setSuggestions([]);
              }}
            >
              <MapPin className="h-4 w-4 text-blue-400" />
              <div>
                <div className="text-white font-medium">{city.name}</div>
                <div className="text-gray-400 text-xs">{city.admin1}, {city.country}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
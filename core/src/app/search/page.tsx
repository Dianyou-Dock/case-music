"use client";

import { useState } from "react";
import { Search as SearchIcon, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SearchResults from "@/components/search/search-results";
import SearchFilters from "@/components/search/search-filters";
import SearchSuggestions from "@/components/search/search-suggestions";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Search</h1>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for songs, artists, or albums..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
            {query === "" && <SearchSuggestions />}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "bg-accent" : ""}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {showFilters && (
          <div className="w-64">
            <SearchFilters />
          </div>
        )}
        <div className="flex-1">
          <SearchResults query={query} />
        </div>
      </div>
    </div>
  );
}
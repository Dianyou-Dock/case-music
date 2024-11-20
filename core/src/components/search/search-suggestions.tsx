import { Clock } from "lucide-react";

const suggestions = [
  {
    type: "Recent",
    items: [
      "Synthwave Mix",
      "The Midnight",
      "Summer Playlist",
      "Electronic Beats"
    ]
  },
  {
    type: "Trending",
    items: [
      "Top 50 Global",
      "New Releases",
      "Weekend Playlist",
      "Workout Mix"
    ]
  }
];

export default function SearchSuggestions() {
  return (
    <div className="absolute top-full z-10 mt-2 w-full rounded-lg border bg-card p-4 shadow-lg">
      {suggestions.map((section) => (
        <div key={section.type} className="mb-4 last:mb-0">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            {section.type}
          </h3>
          <div className="space-y-1">
            {section.items.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SearchFilters() {
  return (
    <div className="flex flex-col gap-6 rounded-lg border bg-card p-4">
      <div className="space-y-2">
        <h3 className="font-medium">Type</h3>
        <RadioGroup defaultValue="all">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="all" />
            <Label htmlFor="all">All</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="songs" id="songs" />
            <Label htmlFor="songs">Songs</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="albums" id="albums" />
            <Label htmlFor="albums">Albums</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="artists" id="artists" />
            <Label htmlFor="artists">Artists</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Genre</h3>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="All Genres" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genres</SelectItem>
            <SelectItem value="synthwave">Synthwave</SelectItem>
            <SelectItem value="electronic">Electronic</SelectItem>
            <SelectItem value="pop">Pop</SelectItem>
            <SelectItem value="rock">Rock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Duration</h3>
        <div className="px-2">
          <Slider
            defaultValue={[180]}
            max={600}
            step={30}
            className="py-4"
          />
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>0:00</span>
          <span>10:00</span>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Release Year</h3>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Any Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Year</SelectItem>
            <SelectItem value="2023">2023</SelectItem>
            <SelectItem value="2022">2022</SelectItem>
            <SelectItem value="2021">2021</SelectItem>
            <SelectItem value="2020">2020</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
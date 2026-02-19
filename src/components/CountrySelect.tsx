import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES, Country } from "@/lib/countries";

interface CountrySelectProps {
  value: string;
  onChange: (countryCode: string, timezone: string) => void;
}

const CountrySelect = ({ value, onChange }: CountrySelectProps) => {
  const handleChange = (countryCode: string) => {
    const country = COUNTRIES.find(c => c.code === countryCode);
    if (country) {
      onChange(country.code, country.timezone);
    }
  };

  const selectedCountry = COUNTRIES.find(c => c.code === value);

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="w-full h-auto min-h-10" lineClamp={false}>
        <SelectValue>
          {selectedCountry ? (
            <span className="flex items-center gap-2">
              <span className="text-base">{selectedCountry.flag}</span>
              <span>{selectedCountry.name}</span>
            </span>
          ) : (
            "Selecciona un país"
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {COUNTRIES.map((country) => (
          <SelectItem key={country.code} value={country.code}>
            <span className="flex items-center gap-2">
              <span className="text-base">{country.flag}</span>
              <span>{country.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CountrySelect;

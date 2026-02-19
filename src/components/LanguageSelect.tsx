import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES, Language } from "@/lib/translations";

interface LanguageSelectProps {
  value: Language;
  onChange: (value: Language) => void;
}

const LanguageSelect = ({ value, onChange }: LanguageSelectProps) => {
  return (
    <Select value={value} onValueChange={(val) => onChange(val as Language)}>
      <SelectTrigger className="w-full h-auto min-h-10" lineClamp={false}>
        <SelectValue placeholder="Seleccionar idioma" />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((language) => (
          <SelectItem key={language.code} value={language.code}>
            <span className="flex items-center gap-2">
              <span>{language.flag}</span>
              <span>{language.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default LanguageSelect;

import React from 'react';
import { SUPPORTED_LANGUAGES } from '../../data/languages';

interface LanguageSelectorProps {
  value: string;
  onChange: (code: string) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-300">Language / Script</label>
      <select
        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-slate-800">
            {lang.name} ({lang.nativeName})
          </option>
        ))}
      </select>
    </div>
  );
};

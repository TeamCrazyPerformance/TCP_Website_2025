import React from 'react';

export default function FormSelect({ label, name, value, onChange, options = [], required = false }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="form-select w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4 focus:ring-2 focus:ring-accent-blue focus:outline-none"
      >
        <option value="">선택하세요</option>
        {options.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
    </div>
  );
}

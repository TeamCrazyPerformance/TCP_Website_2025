import React from 'react';

export default function FormInput({ label, name, value, onChange, type = 'text', required = false, placeholder = '', min, max, maxLength, inputMode }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        maxLength={maxLength}
        inputMode={inputMode}
        className="form-input"
      />
    </div>
  );
}

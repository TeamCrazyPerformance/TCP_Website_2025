import React from 'react';

export default function FormInput({ label, name, value, onChange, type = 'text', required = false, placeholder = '', min, max }) {
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
        className="form-input"
      />
    </div>
  );
}

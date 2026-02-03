import React from 'react';

export default function FormTextarea({ label, name, value, onChange, required = false, placeholder = '', rows = 4 }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        rows={rows}
        className="form-textarea"
      />
    </div>
  );
}

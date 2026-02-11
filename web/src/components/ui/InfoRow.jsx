import React from 'react';

export default function InfoRow({ label, children }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}:</span>
      <span>{children}</span>
    </div>
  );
}

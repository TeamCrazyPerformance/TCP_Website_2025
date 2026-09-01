import React from 'react';
import { Link } from 'react-router-dom';

export default function BackToListLink({ to, children, className = '' }) {
  return (
    <Link to={to} className={`public-back-to-list-link ${className}`.trim()}>
      <i className="fas fa-arrow-left" aria-hidden="true"></i>
      {children}
    </Link>
  );
}

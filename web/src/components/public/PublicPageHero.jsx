import React from 'react';

export default function PublicPageHero({
  icon,
  iconClassName = '',
  title,
  titleClassName = '',
  lead,
  description,
  action = null,
  className = '',
}) {
  return (
    <section className={`compact-page-hero ${className}`.trim()}>
      <div className="container site-content-container mx-auto px-4">
        <div className="text-center">
          <div className="mb-8">
            <div
              className={`site-hero-icon w-24 h-24 mx-auto rounded-full flex items-center justify-center ${iconClassName}`.trim()}
              aria-hidden="true"
            >
              {icon}
            </div>
            <h1 className="site-hero-title orbitron mb-4">
              <span className={`gradient-text ${titleClassName}`.trim()}>{title}</span>
            </h1>
            {lead && (
              <p className="site-hero-lead text-gray-300 max-w-2xl mx-auto">
                {lead}
              </p>
            )}
            {description && (
              <p className="site-hero-description text-gray-400 max-w-2xl mx-auto">
                {description}
              </p>
            )}
            {action}
          </div>
        </div>
      </div>
    </section>
  );
}

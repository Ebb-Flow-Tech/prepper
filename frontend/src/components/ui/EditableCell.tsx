'use client';

import { useState, useRef, useEffect } from 'react';

export interface EditableCellProps {
  value: string;
  onSave: (value: string) => void;
  type?: 'text' | 'number' | 'email';
  className?: string;
  displayValue?: string;
  placeholder?: string;
}

export function EditableCell({
  value,
  onSave,
  type = 'text',
  className = '',
  displayValue,
  placeholder,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    let finalValue = editValue;
    if (type === 'number') {
      const n = parseFloat(editValue);
      if (!isNaN(n)) finalValue = String(n);
    }
    if (finalValue !== value) {
      onSave(finalValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type === 'number' ? 'text' : type}
        inputMode={type === 'number' ? 'decimal' : undefined}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full rounded-md border border-input bg-card px-1 py-0.5 text-sm text-foreground focus-visible:border-[var(--border-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      />
    );
  }

  const display = displayValue ?? value;

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer rounded-md px-1 py-0.5 transition-colors duration-[120ms] hover:bg-accent ${className}`}
    >
      {display || <span className="text-muted-foreground italic">{placeholder || '-'}</span>}
    </span>
  );
}

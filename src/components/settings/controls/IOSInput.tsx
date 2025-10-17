interface IOSInputProps {
  type?: 'text' | 'password' | 'email';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  spellCheck?: boolean;
}

export default function IOSInput({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  autoComplete = 'off',
  spellCheck = false,
}: IOSInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete={autoComplete}
      spellCheck={spellCheck}
      className="ios-input"
    />
  );
}

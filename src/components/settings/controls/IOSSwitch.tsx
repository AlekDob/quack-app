interface IOSSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function IOSSwitch({ checked, onChange, disabled = false }: IOSSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`ios-switch ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`}
    >
      <span className="ios-switch-thumb" />
    </button>
  );
}

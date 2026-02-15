export default function ActionBtn({ label, title, color = "#007a22", onClick, small, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      title={title}
      style={{
        padding: small ? "2px 6px" : "3px 8px",
        border: `1px solid ${disabled ? "#003310" : color + "44"}`,
        color: disabled ? "#003310" : color,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: small ? 10 : 11,
        lineHeight: 1,
        transition: "all 0.15s",
        userSelect: "none",
      }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.background = `${color}15`;
      }}
      onMouseLeave={e => {
        if (disabled) return;
        e.currentTarget.style.borderColor = disabled ? "#003310" : color + "44";
        e.currentTarget.style.background = "transparent";
      }}
    >{label}</div>
  );
}

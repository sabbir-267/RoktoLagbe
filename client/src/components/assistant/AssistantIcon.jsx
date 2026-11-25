// RoktoLagbe assistant logo: a blood drop with "AI" written inside it.
//   variant="solid"   white drop with red letters (for the red launcher button)
//   variant="outline" drop in the current text colour with white letters (for light backgrounds)
const DROP = "M12 1.5C11.5 2.1 4.6 9.8 4.6 15.1a7.4 7.4 0 0 0 14.8 0C19.4 9.8 12.5 2.1 12 1.5z";

export default function AssistantIcon({ size = 24, variant = "outline", className = "" }) {
  const solid = variant === "solid";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={DROP} fill={solid ? "#fff" : "currentColor"} />
      <text
        x="12"
        y="18.1"
        textAnchor="middle"
        fontSize="7.6"
        fontWeight="800"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
        letterSpacing="0.2"
        fill={solid ? "var(--color-brand-red)" : "#fff"}
      >
        AI
      </text>
    </svg>
  );
}

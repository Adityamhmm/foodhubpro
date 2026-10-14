import { Utensils } from "lucide-react";

export function FoodVisual({
  src,
  alt,
  tone = "sage",
}: {
  src?: string | null;
  alt: string;
  tone?: string;
}) {
  if (src)
    return (
      <img className="food-visual photo" src={src} alt={alt} loading="lazy" />
    );
  return (
    <div
      className={`food-visual plate plate-${tone}`}
      role="img"
      aria-label={alt}
    >
      <span className="plate-ring">
        <span className="plate-center">
          <Utensils size={20} strokeWidth={1.45} />
        </span>
      </span>
    </div>
  );
}

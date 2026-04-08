interface AxieClassIconProps {
  axieClass: string;
  size?: number;
  className?: string;
}

export function AxieClassIcon({ axieClass, size = 16, className }: AxieClassIconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://cdn.axieinfinity.com/marketplace-website/asset-icon/class/${axieClass.toLowerCase()}.png`}
      alt={axieClass}
      width={size}
      height={size}
      className={className}
    />
  );
}

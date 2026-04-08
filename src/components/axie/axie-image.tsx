import Image from "next/image";

interface AxieImageProps {
  axieId: string;
  name?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function AxieImage({
  axieId,
  name,
  width = 200,
  height = 200,
  className,
}: AxieImageProps) {
  return (
    <Image
      src={`https://axiecdn.axieinfinity.com/axies/${axieId}/axie/axie-full-transparent.png`}
      alt={name || `Axie #${axieId}`}
      width={width}
      height={height}
      className={className}
    />
  );
}

// Invisible fixed-dimension ad reservation (D-11).
// Renders an empty box with reserved dimensions so later ad activation
// causes zero layout shift. Emits no requests and shows nothing visible.
type AdSlotProps = {
  id: string;
  width: number;
  height: number;
};

export default function AdSlot({ id, width, height }: AdSlotProps) {
  return (
    <div
      aria-hidden="true"
      data-ad-slot={id}
      style={{ width, height, minWidth: width, minHeight: height }}
      className="mx-auto overflow-hidden"
    />
  );
}

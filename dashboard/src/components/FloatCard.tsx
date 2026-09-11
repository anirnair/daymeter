import { Tooltip } from "@base-ui/react/tooltip";
import type { ReactElement } from "react";

type Props = {
  title: string;
  lines: string[];
  children: ReactElement;
};

export function FloatCard({ title, lines, children }: Props) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={10}>
          <Tooltip.Popup className="float-card">
            <div className="title">{title}</div>
            {lines.map((line) => (
              <div className="row" key={line}>
                {line}
              </div>
            ))}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

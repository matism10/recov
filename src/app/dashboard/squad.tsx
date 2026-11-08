import { SquadList, type SquadProps } from "./squad-list";
import { SquadTable } from "./squad-table";

// Plantel: lista en celular y tablet, tabla en escritorio (lg+). Mismos datos.
export function Squad(props: SquadProps) {
  return (
    <>
      <div className="lg:hidden">
        <SquadList {...props} />
      </div>
      <div className="hidden lg:block">
        <SquadTable {...props} />
      </div>
    </>
  );
}

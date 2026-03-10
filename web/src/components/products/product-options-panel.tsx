import { ProductOption, RoomObject } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProductOptionsPanelProps {
  roomObject: RoomObject | undefined;
}

function ProductOptionRow({ option }: { option: ProductOption }) {
  return (
    <li className="rounded-md border border-border p-3">
      <p className="text-sm font-medium">{option.title}</p>
      <p className="mt-1 text-xs text-gray-500">Supplier: {option.supplier}</p>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span>{option.price.toLocaleString()} THB</span>
        <span>{option.leadTimeDays} days lead time</span>
      </div>
    </li>
  );
}

export function ProductOptionsPanel({ roomObject }: ProductOptionsPanelProps) {
  if (!roomObject) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Product Options</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-500">
          Select an object in the middle panel to preview product options.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{roomObject.name} Options</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {roomObject.productOptions.map((option) => (
            <ProductOptionRow key={option.id} option={option} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

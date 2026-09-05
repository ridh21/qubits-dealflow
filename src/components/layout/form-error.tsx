import { Alert, AlertDescription } from "@/components/ui/alert";
import { WarningCircle } from "@/components/icons";

/**
 * Renders nothing when there is no error. The previous pattern - an always
 * mounted `<p role="alert">` - left an empty element taking up layout on every
 * screen, and announced an empty alert to screen readers.
 */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <WarningCircle className="size-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

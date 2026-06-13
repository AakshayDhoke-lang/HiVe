import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useHive } from "@/lib/hive-store";
import type { Subject } from "@/lib/hive-store";
import { toast } from "sonner";

const PRESET = [
  "#7c3aed", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#06b6d4", "#8b5cf6",
];

export function SubjectModal({
  open,
  edit,
  onOpenChange,
}: {
  open: boolean;
  edit?: Subject;
  onOpenChange: (open: boolean) => void;
}) {
  const { addSubject, updateSubject } = useHive();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET[0]);

  useEffect(() => {
    if (open) {
      setName(edit?.name ?? "");
      setColor(edit?.color ?? PRESET[0]);
    }
  }, [open, edit]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name is required");
    try {
      if (edit) {
        await updateSubject(edit.id, { name: name.trim(), color });
        toast.success("Subject updated");
      } else {
        await addSubject({ name: name.trim(), color });
        toast.success("Subject created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Failed to save subject");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit subject" : "New subject"}</DialogTitle>
          <DialogDescription>
            Organize your PDFs and chats by topic.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sub-name">Name</Label>
            <Input
              id="sub-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Contracts"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${
                    color === c ? "scale-110 border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-12 cursor-pointer p-0.5"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} className="bg-brand text-white hover:opacity-90">
            {edit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { uploadSlidesAction, type ActionResult } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Upload className="h-4 w-4" />
          Yuklash
        </>
      )}
    </Button>
  );
}

export function SlideUploadForm({ presentationId }: { presentationId: number }) {
  const action = uploadSlidesAction.bind(null, presentationId);
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    action,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      const data = state.data as { count: number };
      toast.success(`${data.count} ta slayd yuklandi.`);
      formRef.current?.reset();
    } else if (state && state.ok === false) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      encType="multipart/form-data"
      className="space-y-3"
    >
      <input
        name="slides"
        type="file"
        accept="image/webp,image/jpeg,image/png"
        multiple
        required
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground hover:file:bg-primary/90"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Bir nechta fayl tanlash mumkin. Tartib fayl nomi bo'yicha o'rnatiladi
          (`01.webp`, `02.webp`, …).
        </p>
        <Submit />
      </div>
    </form>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ImageIcon, Loader2, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MathInput } from "@/components/ui/math-input";
import { cn } from "@/lib/utils";
import type {
  AdminChoiceInput,
  AdminMatchPairInput,
  AdminQuestion,
  AdminQuestionPayload,
  Difficulty,
  ImageAction,
  QuestionType,
} from "@/types/api";

import {
  createQuestionAction,
  updateQuestionAction,
} from "./test-actions";

const SINGLE_DEFAULT: AdminChoiceInput[] = [
  { text: "", is_correct: true },
  { text: "", is_correct: false },
];

const MULTI_DEFAULT: AdminChoiceInput[] = [
  { text: "", is_correct: true },
  { text: "", is_correct: true },
  { text: "", is_correct: false },
  { text: "", is_correct: false },
];

const MATCH_DEFAULT: AdminMatchPairInput[] = [
  { left_text: "", right_text: "" },
  { left_text: "", right_text: "" },
  { left_text: "", right_text: "" },
];

const KEEP: ImageAction = { action: "keep" };
const CLEAR: ImageAction = { action: "clear" };

type Props =
  | { mode: "create"; poolId: number; onDone?: () => void }
  | {
      mode: "edit";
      poolId: number;
      question: AdminQuestion;
      onDone?: () => void;
    };

export function QuestionForm(props: Props) {
  const initial: AdminQuestion | null =
    props.mode === "edit" ? props.question : null;

  const [text, setText] = useState(initial?.text ?? "");
  const [questionType, setQuestionType] = useState<QuestionType>(
    initial?.question_type ?? "single",
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    initial?.difficulty ?? "medium",
  );

  // Existing-item ids carried through so the backend can merge by id (and
  // preserve images that we aren't touching).
  const [choices, setChoices] = useState<(AdminChoiceInput & { id?: number })[]>(
    () => {
      if (initial && initial.question_type !== "matching") {
        return initial.choices.map((c) => ({
          id: c.id,
          text: c.text,
          is_correct: c.is_correct,
        }));
      }
      return SINGLE_DEFAULT.map((c) => ({ ...c }));
    },
  );
  const [pairs, setPairs] = useState<(AdminMatchPairInput & { id?: number })[]>(
    () => {
      if (initial && initial.question_type === "matching") {
        return initial.pairs.map((p) => ({
          id: p.id,
          left_text: p.left_text,
          right_text: p.right_text,
        }));
      }
      return MATCH_DEFAULT.map((p) => ({ ...p }));
    },
  );

  // Image actions — parallel arrays. "keep" means leave existing alone.
  const [questionImageAction, setQuestionImageAction] = useState<ImageAction>(KEEP);
  const [choiceImageActions, setChoiceImageActions] = useState<ImageAction[]>(
    () => choices.map(() => KEEP),
  );
  const [pairImageActions, setPairImageActions] = useState<
    { left: ImageAction; right: ImageAction }[]
  >(() => pairs.map(() => ({ left: KEEP, right: KEEP })));

  const [isPending, startTransition] = useTransition();

  const switchType = (next: QuestionType) => {
    setQuestionType(next);
    if (next === "single") {
      const fresh = SINGLE_DEFAULT.map((c) => ({ ...c }));
      setChoices(fresh);
      setChoiceImageActions(fresh.map(() => KEEP));
    } else if (next === "multi") {
      const fresh = MULTI_DEFAULT.map((c) => ({ ...c }));
      setChoices(fresh);
      setChoiceImageActions(fresh.map(() => KEEP));
    } else {
      const fresh = MATCH_DEFAULT.map((p) => ({ ...p }));
      setPairs(fresh);
      setPairImageActions(fresh.map(() => ({ left: KEEP, right: KEEP })));
    }
  };

  const updateChoice = (
    idx: number,
    patch: Partial<AdminChoiceInput>,
  ) => {
    setChoices((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    );
  };
  const setSingleCorrect = (idx: number) => {
    setChoices((prev) =>
      prev.map((c, i) => ({ ...c, is_correct: i === idx })),
    );
  };
  const toggleMultiCorrect = (idx: number) => {
    setChoices((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, is_correct: !c.is_correct } : c)),
    );
  };
  const addChoice = () => {
    setChoices((prev) => [...prev, { text: "", is_correct: false }]);
    setChoiceImageActions((prev) => [...prev, KEEP]);
  };
  const removeChoice = (idx: number) => {
    setChoices((prev) => prev.filter((_, i) => i !== idx));
    setChoiceImageActions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updatePair = (idx: number, patch: Partial<AdminMatchPairInput>) => {
    setPairs((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  };
  const addPair = () => {
    setPairs((prev) => [...prev, { left_text: "", right_text: "" }]);
    setPairImageActions((prev) => [...prev, { left: KEEP, right: KEEP }]);
  };
  const removePair = (idx: number) => {
    setPairs((prev) => prev.filter((_, i) => i !== idx));
    setPairImageActions((prev) => prev.filter((_, i) => i !== idx));
  };

  const setChoiceImage = (idx: number, action: ImageAction) =>
    setChoiceImageActions((prev) =>
      prev.map((a, i) => (i === idx ? action : a)),
    );
  const setPairImage = (
    idx: number,
    side: "left" | "right",
    action: ImageAction,
  ) =>
    setPairImageActions((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [side]: action } : a)),
    );

  const validate = (): string | null => {
    const questionImageNow = currentImageState(
      questionImageAction,
      initial?.image_url ?? null,
    );
    if (!text.trim() && !questionImageNow) {
      return "Savol matni yoki rasm bo'lishi kerak.";
    }
    if (questionType === "single") {
      if (choices.length < 2) return "Kamida 2 ta variant kerak.";
      if (choices.filter((c) => c.is_correct).length !== 1)
        return "Aynan bitta to'g'ri javob belgilang.";
      const empty = choices.findIndex((c, i) => {
        const img = currentImageState(
          choiceImageActions[i] ?? KEEP,
          initial?.choices[i]?.image_url ?? null,
        );
        return !c.text.trim() && !img;
      });
      if (empty !== -1)
        return `${String.fromCharCode(65 + empty)} variantida matn yoki rasm bo'lishi kerak.`;
    } else if (questionType === "multi") {
      if (choices.length < 2) return "Kamida 2 ta variant kerak.";
      if (choices.filter((c) => c.is_correct).length < 1)
        return "Kamida bitta to'g'ri javob belgilang.";
      const empty = choices.findIndex((c, i) => {
        const img = currentImageState(
          choiceImageActions[i] ?? KEEP,
          initial?.choices[i]?.image_url ?? null,
        );
        return !c.text.trim() && !img;
      });
      if (empty !== -1)
        return `${String.fromCharCode(65 + empty)} variantida matn yoki rasm bo'lishi kerak.`;
    } else {
      if (pairs.length < 2) return "Kamida 2 ta juftlik kerak.";
      const bad = pairs.findIndex((p, i) => {
        const li = currentImageState(
          pairImageActions[i]?.left ?? KEEP,
          initial?.pairs[i]?.left_image_url ?? null,
        );
        const ri = currentImageState(
          pairImageActions[i]?.right ?? KEEP,
          initial?.pairs[i]?.right_image_url ?? null,
        );
        return (!p.left_text.trim() && !li) || (!p.right_text.trim() && !ri);
      });
      if (bad !== -1)
        return `${bad + 1}-juftlikning ikkala tomonida ham matn yoki rasm bo'lishi kerak.`;
    }
    return null;
  };

  const buildFormData = (): FormData => {
    const payload: AdminQuestionPayload & {
      choices?: (AdminChoiceInput & { id?: number })[];
      pairs?: (AdminMatchPairInput & { id?: number })[];
    } = {
      text: text.trim(),
      question_type: questionType,
      difficulty,
      ...(questionType === "matching"
        ? {
            pairs: pairs.map((p) => ({
              ...(p.id ? { id: p.id } : {}),
              left_text: p.left_text.trim(),
              right_text: p.right_text.trim(),
            })),
          }
        : {
            choices: choices.map((c) => ({
              ...(c.id ? { id: c.id } : {}),
              text: c.text.trim(),
              is_correct: c.is_correct,
            })),
          }),
    };

    const form = new FormData();
    form.append("data", JSON.stringify(payload));

    appendImageAction(form, "q_image", questionImageAction);
    if (questionType !== "matching") {
      choiceImageActions.forEach((a, i) =>
        appendImageAction(form, `choice_image_${i}`, a),
      );
    } else {
      pairImageActions.forEach((a, i) => {
        appendImageAction(form, `pair_left_image_${i}`, a.left);
        appendImageAction(form, `pair_right_image_${i}`, a.right);
      });
    }
    return form;
  };

  const submit = () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    const form = buildFormData();

    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createQuestionAction(props.poolId, form)
          : await updateQuestionAction(props.question.id, props.poolId, form);
      if (result.ok) {
        toast.success(
          props.mode === "create" ? "Savol qo'shildi." : "Savol yangilandi.",
        );
        if (props.mode === "create") {
          setText("");
          setQuestionType("single");
          setDifficulty("medium");
          const fresh = SINGLE_DEFAULT.map((c) => ({ ...c }));
          setChoices(fresh);
          setChoiceImageActions(fresh.map(() => KEEP));
          const freshPairs = MATCH_DEFAULT.map((p) => ({ ...p }));
          setPairs(freshPairs);
          setPairImageActions(freshPairs.map(() => ({ left: KEEP, right: KEEP })));
          setQuestionImageAction(KEEP);
        }
        props.onDone?.();
      } else {
        toast.error(result.error);
      }
    });
  };

  const heading = props.mode === "create" ? "Yangi savol" : "Savolni tahrirlash";
  const submitLabel = props.mode === "create" ? "Qo'shish" : "Saqlash";

  return (
    <div className="space-y-4 rounded-md border p-4 bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{heading}</h3>
        {props.onDone && props.mode === "edit" ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => props.onDone?.()}
            aria-label="Bekor qilish"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="q-type">Savol turi</Label>
          <select
            id="q-type"
            value={questionType}
            onChange={(e) => switchType(e.target.value as QuestionType)}
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="single">Bitta to'g'ri javob</option>
            <option value="multi">Bir nechta to'g'ri javob</option>
            <option value="matching">Mos qo'yish</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="q-difficulty">Qiyinlik darajasi</Label>
          <select
            id="q-difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="easy">Oson</option>
            <option value="medium">O'rta</option>
            <option value="hard">Qiyin</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="question-text">Savol matni (ixtiyoriy)</Label>
        <MathInput
          id="question-text"
          value={text}
          onValueChange={setText}
          rows={2}
          placeholder="Masalan: 12 × 8 = ? yoki $\\int_0^1 x^2\\,dx$"
        />
      </div>

      <div className="space-y-2">
        <Label>Savol rasmi (ixtiyoriy)</Label>
        <ImagePicker
          existingUrl={initial?.image_url ?? null}
          action={questionImageAction}
          onChange={setQuestionImageAction}
        />
      </div>

      {questionType === "single" ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Variantlar (radio — bitta to'g'ri javob)
          </div>
          {choices.map((c, idx) => (
            <ChoiceRow
              key={idx}
              idx={idx}
              choice={c}
              correctMode="radio"
              imageAction={choiceImageActions[idx] ?? KEEP}
              existingUrl={initial?.choices[idx]?.image_url ?? null}
              onText={(t) => updateChoice(idx, { text: t })}
              onCorrect={() => setSingleCorrect(idx)}
              onImage={(a) => setChoiceImage(idx, a)}
              onRemove={choices.length > 2 ? () => removeChoice(idx) : null}
            />
          ))}
          <Button variant="outline" size="sm" onClick={addChoice}>
            <Plus className="h-4 w-4" />
            Variant qo'shish
          </Button>
        </div>
      ) : null}

      {questionType === "multi" ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Variantlar (checkbox — bir nechta to'g'ri javob bo'lishi mumkin)
          </div>
          {choices.map((c, idx) => (
            <ChoiceRow
              key={idx}
              idx={idx}
              choice={c}
              correctMode="checkbox"
              imageAction={choiceImageActions[idx] ?? KEEP}
              existingUrl={initial?.choices[idx]?.image_url ?? null}
              onText={(t) => updateChoice(idx, { text: t })}
              onCorrect={() => toggleMultiCorrect(idx)}
              onImage={(a) => setChoiceImage(idx, a)}
              onRemove={choices.length > 2 ? () => removeChoice(idx) : null}
            />
          ))}
          <Button variant="outline" size="sm" onClick={addChoice}>
            <Plus className="h-4 w-4" />
            Variant qo'shish
          </Button>
        </div>
      ) : null}

      {questionType === "matching" ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Mos juftliklar (chap — o'ng)
          </div>
          {pairs.map((p, idx) => (
            <PairRow
              key={idx}
              idx={idx}
              pair={p}
              imageActions={pairImageActions[idx] ?? { left: KEEP, right: KEEP }}
              existingLeftUrl={initial?.pairs[idx]?.left_image_url ?? null}
              existingRightUrl={initial?.pairs[idx]?.right_image_url ?? null}
              onLeftText={(t) => updatePair(idx, { left_text: t })}
              onRightText={(t) => updatePair(idx, { right_text: t })}
              onLeftImage={(a) => setPairImage(idx, "left", a)}
              onRightImage={(a) => setPairImage(idx, "right", a)}
              onRemove={pairs.length > 2 ? () => removePair(idx) : null}
            />
          ))}
          <Button variant="outline" size="sm" onClick={addPair}>
            <Plus className="h-4 w-4" />
            Juftlik qo'shish
          </Button>
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={submit} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : props.mode === "create" ? (
            <>
              <Plus className="h-4 w-4" />
              {submitLabel}
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/** Has a visible image in the final state? Combines the user's intent
 *  (`action`) with the initial server-side state (`existingUrl`). */
function currentImageState(
  action: ImageAction,
  existingUrl: string | null,
): boolean {
  if (action.action === "set") return true;
  if (action.action === "clear") return false;
  return Boolean(existingUrl);
}

function appendImageAction(form: FormData, baseKey: string, action: ImageAction) {
  if (action.action === "set") {
    form.append(baseKey, action.file);
  } else if (action.action === "clear") {
    form.append(`${baseKey}_clear`, "1");
  }
}

function ChoiceRow({
  idx,
  choice,
  correctMode,
  imageAction,
  existingUrl,
  onText,
  onCorrect,
  onImage,
  onRemove,
}: {
  idx: number;
  choice: AdminChoiceInput;
  correctMode: "radio" | "checkbox";
  imageAction: ImageAction;
  existingUrl: string | null;
  onText: (t: string) => void;
  onCorrect: () => void;
  onImage: (a: ImageAction) => void;
  onRemove: (() => void) | null;
}) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-start gap-2">
        <input
          type={correctMode}
          name={correctMode === "radio" ? "correct" : undefined}
          checked={choice.is_correct}
          onChange={onCorrect}
          className="h-4 w-4 accent-primary mt-3"
          aria-label={`${String.fromCharCode(65 + idx)} — to'g'ri javob`}
        />
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold shrink-0 mt-1.5">
          {String.fromCharCode(65 + idx)}
        </span>
        <div className="flex-1">
          <MathInput
            value={choice.text}
            onValueChange={onText}
            rows={2}
            hint={null}
            hideToolbar
            placeholder={`Variant ${String.fromCharCode(65 + idx)} matni ($x^2$ ...)`}
          />
        </div>
        {onRemove ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Variantni o'chirish"
            className="mt-1"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        ) : null}
      </div>
      <ImagePicker
        existingUrl={existingUrl}
        action={imageAction}
        onChange={onImage}
        compact
      />
    </div>
  );
}

function PairRow({
  idx,
  pair,
  imageActions,
  existingLeftUrl,
  existingRightUrl,
  onLeftText,
  onRightText,
  onLeftImage,
  onRightImage,
  onRemove,
}: {
  idx: number;
  pair: AdminMatchPairInput;
  imageActions: { left: ImageAction; right: ImageAction };
  existingLeftUrl: string | null;
  existingRightUrl: string | null;
  onLeftText: (t: string) => void;
  onRightText: (t: string) => void;
  onLeftImage: (a: ImageAction) => void;
  onRightImage: (a: ImageAction) => void;
  onRemove: (() => void) | null;
}) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold">
          {idx + 1}
        </span>
        {onRemove ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Juftlikni o'chirish"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Chap tomon</div>
          <MathInput
            value={pair.left_text}
            onValueChange={onLeftText}
            rows={2}
            hint={null}
            hideToolbar
            placeholder="Matn yoki formula: $x^2$"
          />
          <ImagePicker
            existingUrl={existingLeftUrl}
            action={imageActions.left}
            onChange={onLeftImage}
            compact
          />
        </div>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">O'ng tomon</div>
          <MathInput
            value={pair.right_text}
            onValueChange={onRightText}
            rows={2}
            hint={null}
            hideToolbar
            placeholder="Matn yoki formula: $\\sqrt{y}$"
          />
          <ImagePicker
            existingUrl={existingRightUrl}
            action={imageActions.right}
            onChange={onRightImage}
            compact
          />
        </div>
      </div>
    </div>
  );
}

/** Picks an image: shows a preview (existing or freshly chosen), an upload
 *  button, and a clear button. Communicates intent to the parent as an
 *  `ImageAction`.
 *
 *  Also acts as a paste target: click the preview to focus it (visible ring),
 *  then Cmd/Ctrl+V uploads whatever image is on the clipboard. Drag-and-drop
 *  from Finder/Explorer also works. */
function ImagePicker({
  existingUrl,
  action,
  onChange,
  compact = false,
}: {
  existingUrl: string | null;
  action: ImageAction;
  onChange: (a: ImageAction) => void;
  compact?: boolean;
}) {
  // Local object URL for newly picked files — revoked when it changes.
  const localUrl = useMemo(() => {
    if (action.action === "set") return URL.createObjectURL(action.file);
    return null;
  }, [action]);

  useEffect(() => {
    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [localUrl]);

  const previewUrl =
    action.action === "set"
      ? localUrl
      : action.action === "clear"
        ? null
        : existingUrl;

  const onFile = (file: File | null) => {
    if (!file) return;
    onChange({ action: "set", file });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Only take the first image item — multi-image paste is a rare admin
    // case and would need multiple slots anyway.
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          onFile(file);
          return;
        }
      }
    }
  };

  const [isDragOver, setIsDragOver] = useState(false);
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith("image/"),
    );
    if (file) onFile(file);
  };

  const size = compact ? "h-16 w-16" : "h-24 w-24";

  return (
    <div className="flex items-start gap-3">
      <div
        tabIndex={0}
        role="button"
        aria-label="Rasm yuklash yoki Cmd+V bilan yopishtirish"
        onPaste={handlePaste}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "grid place-items-center rounded-md border-2 border-dashed bg-muted/30 overflow-hidden shrink-0 cursor-pointer transition-colors",
          "focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring",
          isDragOver && "border-primary bg-primary/5",
          size,
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-cover pointer-events-none"
          />
        ) : (
          <ImageIcon className="h-5 w-5 text-muted-foreground pointer-events-none" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1 text-xs cursor-pointer rounded-md border px-3 py-1.5 hover:bg-accent">
          <Upload className="h-3.5 w-3.5" />
          {previewUrl ? "Almashtirish" : "Rasm yuklash"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {previewUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(CLEAR)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            O'chirish
          </Button>
        ) : null}
        <p className="text-[11px] text-muted-foreground w-full">
          Rasmni bosib Cmd/Ctrl+V bilan yopishtiring yoki bu joyga sudrab olib
          tashlang.
        </p>
      </div>
    </div>
  );
}

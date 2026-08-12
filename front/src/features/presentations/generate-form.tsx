"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_SALE_PRICE, GENERATION_PRICE } from "@/lib/constants";
import { formatSom } from "@/lib/utils";
import type { Grade, Subject } from "@/types/api";

import { generatePresentationAction } from "./actions";

const selectClass =
  "flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function GenerateForm({
  subjects,
  grades,
}: {
  subjects: Subject[];
  grades: Grade[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState<number | "">(subjects[0]?.id ?? "");
  const [grade, setGrade] = useState<number | "">(grades[0]?.id ?? "");
  const [quarter, setQuarter] = useState<number | "">("");
  const [numSlides, setNumSlides] = useState(8);
  const [isListed, setIsListed] = useState(true);
  const [price, setPrice] = useState(DEFAULT_SALE_PRICE);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (subject === "" || grade === "") {
      toast.error("Fan va sinfni tanlang.");
      return;
    }
    setPending(true);
    const res = await generatePresentationAction({
      subject: Number(subject),
      grade: Number(grade),
      topic,
      num_slides: numSlides,
      quarter: quarter === "" ? null : Number(quarter),
      price,
      is_listed: isListed,
    });
    if (res.ok) {
      toast.success("Generatsiya boshlandi.");
      router.push(`/presentations/jobs/${res.jobId}`);
    } else {
      toast.error(res.error);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="topic">Mavzu</Label>
        <Input
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Masalan: Kasrlar bilan amallar"
          required
          minLength={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="subject">Fan</Label>
          <select
            id="subject"
            className={selectClass}
            value={subject}
            onChange={(e) => setSubject(Number(e.target.value))}
            required
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="grade">Sinf</Label>
          <select
            id="grade"
            className={selectClass}
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
            required
          >
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quarter">Chorak (ixtiyoriy)</Label>
          <select
            id="quarter"
            className={selectClass}
            value={quarter}
            onChange={(e) =>
              setQuarter(e.target.value === "" ? "" : Number(e.target.value))
            }
          >
            <option value="">Belgilanmagan</option>
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                {q}-chorak
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="num_slides">Slaydlar soni (3-20)</Label>
          <Input
            id="num_slides"
            type="number"
            min={3}
            max={20}
            value={numSlides}
            onChange={(e) => setNumSlides(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id="is_listed"
            checked={isListed}
            onCheckedChange={(v) => setIsListed(Boolean(v))}
          />
          <div className="space-y-1">
            <Label htmlFor="is_listed" className="cursor-pointer">
              Marketplace&apos;ga qo&apos;yish
            </Label>
            <p className="text-xs text-muted-foreground">
              Boshqa o&apos;qituvchilar sotib olishi mumkin. Har xariddan sizga
              daromad tushadi. Belgilanmasa — faqat o&apos;zingiz uchun.
            </p>
          </div>
        </div>
        {isListed ? (
          <div className="space-y-2">
            <Label htmlFor="price">Sotuv narxi (so&apos;m)</Label>
            <Input
              id="price"
              type="number"
              min={0}
              step={1000}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="max-w-[200px]"
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Generatsiya narxi:{" "}
        <span className="font-semibold text-foreground">
          {formatSom(GENERATION_PRICE)}
        </span>{" "}
        — hisobingizdan yechiladi. Xatolik bo&apos;lsa avtomatik qaytariladi.
      </div>

      <Button type="submit" disabled={pending} size="lg" className="gap-2">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Yaratish
      </Button>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminTeacher, Grade, Subject } from "@/types/api";

import {
  resetTeacherPasswordAction,
  updateTeacherAction,
  updateTeacherPreferencesAction,
} from "./teacher-actions";

const selectClass =
  "flex min-h-[8rem] w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TeacherEditForm({
  teacher,
  subjects,
  grades,
}: {
  teacher: AdminTeacher;
  subjects: Subject[];
  grades: Grade[];
}) {
  const [fullName, setFullName] = useState(teacher.full_name ?? "");
  // "admin" OR "superadmin" both have admin panel access — keep the
  // checkbox in sync so a superuser's form doesn't start unchecked (which
  // would PATCH is_admin=false on save and the backend would reject it).
  const [isAdmin, setIsAdmin] = useState(teacher.role !== "teacher");
  const [isActive, setIsActive] = useState<boolean>(teacher.is_active);
  const isSuperuser = teacher.role === "superadmin";
  const [subjectIds, setSubjectIds] = useState<number[]>(
    teacher.subjects.map((s) => s.id),
  );
  const [gradeIds, setGradeIds] = useState<number[]>(
    teacher.grades.map((g) => g.id),
  );
  const [resetPending, setResetPending] = useState(false);
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);

  const [savePending, startSaveTransition] = useTransition();
  const [prefsPending, startPrefsTransition] = useTransition();

  const saveMeta = () => {
    if (!fullName.trim()) {
      toast.error("Ism-familiya kerak.");
      return;
    }
    startSaveTransition(async () => {
      // Don't send is_admin for superusers — the flag is decoupled from
      // the "admin panel access" role for them (Django /admin/ decides),
      // and the backend's validate_is_admin blocks toggling anyway.
      const body: Parameters<typeof updateTeacherAction>[1] = {
        full_name: fullName.trim(),
        is_active: isActive,
      };
      if (!isSuperuser) body.is_admin = isAdmin;
      const result = await updateTeacherAction(teacher.id, body);
      if (result.ok) toast.success("Saqlandi.");
      else toast.error(result.error);
    });
  };

  const savePrefs = () => {
    startPrefsTransition(async () => {
      const result = await updateTeacherPreferencesAction(teacher.id, {
        subjects: subjectIds,
        grades: gradeIds,
      });
      if (result.ok) toast.success("Sozlamalar yangilandi.");
      else toast.error(result.error);
    });
  };

  const resetPassword = () => {
    if (!confirm("Parolni yangilashni tasdiqlaysizmi? Eski parol ishlamaydi.")) return;
    setResetPending(true);
    setIssuedPassword(null);
    (async () => {
      const result = await resetTeacherPasswordAction(teacher.id);
      setResetPending(false);
      if (result.ok) {
        setIssuedPassword(result.data.password);
        toast.success("Yangi parol yaratildi.");
      } else {
        toast.error(result.error);
      }
    })();
  };

  const toggleMulti = (
    ids: number[],
    setIds: (v: number[]) => void,
    id: number,
  ) => {
    setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  };

  return (
    <div className="space-y-6">
      {/* Profile fields */}
      <section className="space-y-4 rounded-lg border p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Profil
        </h3>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={teacher.email} disabled />
          <p className="text-xs text-muted-foreground">
            Email o'zgartirilmaydi (JWT sessiyaga bog'liq).
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="full_name">Ism-familiya</Label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              disabled={isSuperuser}
            />
            {isSuperuser ? "Superuser (Django admin panelidan)" : "Admin rolini bering"}
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Faol foydalanuvchi (bloklanmagan)
          </label>
        </div>
        <div className="flex justify-end">
          <Button onClick={saveMeta} disabled={savePending}>
            {savePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                Profilni saqlash
              </>
            )}
          </Button>
        </div>
      </section>

      {/* Preferences */}
      <section className="space-y-4 rounded-lg border p-5">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Fan × sinf sozlamalari
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Tanlangan har bir fan har bir sinf bilan juftlashadi. Admin
            sifatida siz onboarding qulfini o'chirasiz.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Fanlar</Label>
            <div className={selectClass}>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((s) => {
                  const active = subjectIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        toggleMulti(subjectIds, setSubjectIds, s.id)
                      }
                      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-accent"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Sinflar</Label>
            <div className={selectClass}>
              <div className="flex flex-wrap gap-1.5">
                {grades.map((g) => {
                  const active = gradeIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleMulti(gradeIds, setGradeIds, g.id)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-accent"
                      }`}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={savePrefs} disabled={prefsPending}>
            {prefsPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                Sozlamalarni saqlash
              </>
            )}
          </Button>
        </div>
      </section>

      {/* Password reset */}
      <section className="space-y-3 rounded-lg border p-5">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Parolni yangilash
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Yangi tasodifiy parol yaratiladi. Sizga bir marta ko'rsatiladi —
            o'qituvchiga ehtiyotkorlik bilan yetkazing (Telegram, telefon).
          </p>
        </div>
        {issuedPassword ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="text-xs font-medium text-amber-900 dark:text-amber-200 mb-1">
              Yangi parol (bir marta ko'rsatiladi):
            </div>
            <code className="block text-sm font-mono font-bold tabular-nums select-all">
              {issuedPassword}
            </code>
          </div>
        ) : null}
        <div>
          <Button
            variant="outline"
            onClick={resetPassword}
            disabled={resetPending}
          >
            {resetPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                Yangi parol yaratish
              </>
            )}
          </Button>
        </div>
      </section>
    </div>
  );
}
